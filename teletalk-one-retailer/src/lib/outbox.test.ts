import { createOutbox, type OutboxEntry } from './outbox'
import type { SyncStore } from './storage'
import { ApiError } from './http'

/**
 * The queue's four promises, tested against the real implementation:
 *
 *  1. One idempotency key per mutation, reused on every retry.
 *  2. A double tap queues one entry, not two.
 *  3. Only transient failures retry; a rejected NID fails terminally.
 *  4. Being offline does not spend a retry attempt.
 *
 * These are the tests that make "settles exactly once" a claim rather than a
 * hope, so they drive the queue directly — no React, no screens.
 */

function memoryStore(): SyncStore {
  const map = new Map<string, string>()
  return {
    get: (key: string) => map.get(key) ?? null,
    set: (key: string, value: string) => void map.set(key, value),
    remove: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  }
}

function harness(options: {
  send?: (entry: OutboxEntry) => Promise<unknown>
  online?: () => boolean
  store?: SyncStore
}) {
  let now = 1_000_000
  const outbox = createOutbox({
    send: options.send ?? (() => Promise.resolve({ ok: true })),
    online: options.online ?? (() => true),
    store: options.store ?? memoryStore(),
    subscribeOnline: () => () => undefined,
    now: () => now,
    backoff: () => 1000,
    autoFlush: false,
  })
  outbox.start()
  return { outbox, advance: (ms: number) => (now += ms) }
}

const enqueueRecharge = (outbox: ReturnType<typeof harness>['outbox'], id?: string) =>
  outbox.enqueue({ kind: 'recharge', path: '/transactions/recharge', body: { amount: 50 }, id })

it('reuses one idempotency key across every attempt', async () => {
  const seen: string[] = []
  let fail = true
  const { outbox, advance } = harness({
    send: (entry) => {
      seen.push(entry.id)
      if (fail) {
        fail = false
        return Promise.reject(new ApiError('server', 500))
      }
      return Promise.resolve({ ok: true })
    },
  })

  const entry = enqueueRecharge(outbox)
  await outbox.flush()
  // The backoff is real time, so the clock has to move before the entry is due
  // again. Injecting `now` is what keeps this test from sleeping for a second.
  advance(2000)
  await outbox.flush()

  expect(seen).toHaveLength(2)
  expect(new Set(seen).size).toBe(1)
  expect(seen[0]).toBe(entry.id)
  expect(outbox.get(entry.id)?.status).toBe('settled')
})

it('queues one entry for a double tap', () => {
  const { outbox } = harness({})
  const first = enqueueRecharge(outbox, 'tap-key')
  const second = enqueueRecharge(outbox, 'tap-key')

  expect(second.id).toBe(first.id)
  expect(outbox.list()).toHaveLength(1)
})

it('fails terminally on a rejection the retailer has to fix', async () => {
  const { outbox } = harness({
    send: () => Promise.reject(new ApiError('conflict', 409, 'nidBlocked')),
  })

  const entry = enqueueRecharge(outbox)
  await outbox.flush()

  const stored = outbox.get(entry.id)
  expect(stored?.status).toBe('failed')
  expect(stored?.attempts).toBe(1)
  // The remedy the server named, not "something went wrong".
  expect(stored?.errorKey).toBe('error.nidBlocked')
})

it('does not spend an attempt while the handset is offline', async () => {
  let online = false
  const { outbox } = harness({ online: () => online })

  const entry = enqueueRecharge(outbox)
  await outbox.flush()
  expect(outbox.get(entry.id)?.attempts).toBe(0)
  expect(outbox.get(entry.id)?.status).toBe('pending')

  online = true
  await outbox.flush()
  expect(outbox.get(entry.id)?.status).toBe('settled')
})

it('reopens an entry the app died mid-send', async () => {
  const store = memoryStore()
  store.set(
    'teletalk.outbox',
    JSON.stringify([
      {
        id: 'k1',
        kind: 'recharge',
        path: '/transactions/recharge',
        body: {},
        status: 'inflight',
        attempts: 1,
        queuedAt: 1_000_000,
        nextAttemptAt: 0,
      },
    ]),
  )

  const { outbox } = harness({ store })
  // Not lost, and not silently marked done: it is pending, and the shared
  // idempotency key is what makes re-sending it safe.
  expect(outbox.get('k1')?.status).toBe('pending')
})

it('empties itself on sign-out', () => {
  const { outbox } = harness({})
  enqueueRecharge(outbox)
  outbox.clear()
  expect(outbox.list()).toHaveLength(0)
  expect(outbox.unsettledCount()).toBe(0)
})
