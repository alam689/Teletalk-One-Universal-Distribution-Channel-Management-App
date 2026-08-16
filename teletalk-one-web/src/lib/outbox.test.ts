import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './http'
import { createOutbox, type OutboxEntry, type Sender } from './outbox'

/**
 * The queue's guarantees, pinned.
 *
 * The one that matters most to a customer is "settles exactly once": a
 * recharge submitted with the tower down must not become two recharges when it
 * comes back. Everything else here exists to keep that true under retries,
 * reloads and double taps.
 */

let clock = 1_000_000
const now = () => clock

function harness(send: Sender, storageKey = `test.${Math.random()}`) {
  return createOutbox({ send, now, backoff: () => 0, storageKey, autoFlush: false })
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
}

afterEach(() => {
  setOnline(true)
  clock = 1_000_000
})

const ACTIVATION = { kind: 'activation', path: '/transactions', body: { kind: 'activation' } }

describe('outbox — offline', () => {
  it('queues without sending, then settles exactly once when the tower returns', async () => {
    const send = vi.fn<Sender>(async () => ({ transactionId: 'ACT1' }))
    const queue = harness(send)

    setOnline(false)
    const entry = queue.enqueue(ACTIVATION)
    await queue.flush()

    expect(send).not.toHaveBeenCalled()
    expect(queue.get(entry.id)?.status).toBe('pending')

    setOnline(true)
    await queue.flush()
    await queue.flush() // a second wake-up must not re-send a settled mutation

    expect(send).toHaveBeenCalledTimes(1)
    const settled = queue.get(entry.id)
    expect(settled?.status).toBe('settled')
    expect(settled?.result).toEqual({ transactionId: 'ACT1' })
  })

  it('does not spend a retry attempt on being offline', async () => {
    const send = vi.fn<Sender>(async () => {
      throw new ApiError('offline')
    })
    const queue = harness(send)
    const entry = queue.enqueue(ACTIVATION)

    await queue.flush()

    expect(queue.get(entry.id)?.status).toBe('pending')
    expect(queue.get(entry.id)?.attempts).toBe(0)
  })
})

describe('outbox — idempotency', () => {
  it('reuses the same key across retries, so the server can deduplicate', async () => {
    const seen: string[] = []
    let first = true
    const send = vi.fn<Sender>(async (entry: OutboxEntry) => {
      seen.push(entry.id)
      if (first) {
        first = false
        throw new ApiError('server', 500)
      }
      return { transactionId: 'ACT1' }
    })
    const queue = harness(send)
    const entry = queue.enqueue(ACTIVATION)

    await queue.flush()
    expect(queue.get(entry.id)?.status).toBe('pending')

    await queue.flush()

    expect(seen).toEqual([entry.id, entry.id])
    expect(queue.get(entry.id)?.status).toBe('settled')
    expect(queue.get(entry.id)?.attempts).toBe(2)
  })

  it('a double tap with the same key queues one entry, not two', () => {
    const queue = harness(async () => ({}))
    const a = queue.enqueue({ ...ACTIVATION, id: 'fixed-key' })
    const b = queue.enqueue({ ...ACTIVATION, id: 'fixed-key' })

    expect(a.id).toBe(b.id)
    expect(queue.list()).toHaveLength(1)
  })
})

describe('outbox — failure handling', () => {
  it('does not retry a rejection that needs the retailer', async () => {
    const send = vi.fn<Sender>(async () => {
      throw new ApiError('conflict', 409, 'simAlreadyActive')
    })
    const queue = harness(send)
    const entry = queue.enqueue(ACTIVATION)

    await queue.flush()
    await queue.flush()

    expect(send).toHaveBeenCalledTimes(1)
    expect(queue.get(entry.id)?.status).toBe('failed')
    expect(queue.get(entry.id)?.errorKey).toBe('error.simAlreadyActive')
  })

  it('gives up after the attempt budget and says why', async () => {
    const send = vi.fn<Sender>(async () => {
      throw new ApiError('server', 500)
    })
    const queue = harness(send)
    const entry = queue.enqueue(ACTIVATION)

    for (let i = 0; i < 6; i++) await queue.flush()

    expect(queue.get(entry.id)?.status).toBe('failed')
    expect(send).toHaveBeenCalledTimes(5)
  })

  it('lets the retailer retry a failed mutation under its original key', async () => {
    let fail = true
    const send = vi.fn<Sender>(async () => {
      if (fail) throw new ApiError('conflict', 409, 'simAlreadyActive')
      return { transactionId: 'ACT1' }
    })
    const queue = harness(send)
    const entry = queue.enqueue(ACTIVATION)
    await queue.flush()
    expect(queue.get(entry.id)?.status).toBe('failed')

    fail = false
    queue.retry(entry.id)
    await queue.flush()

    expect(queue.get(entry.id)?.status).toBe('settled')
    expect(send.mock.calls.every(([e]) => e.id === entry.id)).toBe(true)
  })

  it('holds the queue in order — nothing overtakes a mutation that has not landed', async () => {
    const sent: string[] = []
    const send = vi.fn<Sender>(async (entry) => {
      if (entry.kind === 'activation') throw new ApiError('timeout')
      sent.push(entry.kind)
      return {}
    })
    const queue = harness(send)
    queue.enqueue(ACTIVATION)
    queue.enqueue({ kind: 'recharge', path: '/transactions/recharge', body: {} })

    await queue.flush()

    // The recharge is for the number the activation has not yet created.
    expect(sent).toEqual([])
  })
})

describe('outbox — surviving a reload', () => {
  it('restores pending entries and re-arms one that died in flight', async () => {
    const key = 'test.reload'
    const first = harness(async () => {
      throw new ApiError('network')
    }, key)
    const entry = first.enqueue(ACTIVATION)
    await first.flush()
    expect(first.get(entry.id)?.status).toBe('pending')

    // The tab is reloaded: a brand new store over the same storage.
    const send = vi.fn<Sender>(async () => ({ transactionId: 'ACT1' }))
    const second = createOutbox({
      send,
      now,
      backoff: () => 0,
      storageKey: key,
      autoFlush: false,
    })

    expect(second.get(entry.id)?.status).toBe('pending')
    await second.flush()
    expect(second.get(entry.id)?.status).toBe('settled')
    expect(send.mock.calls[0][0].id).toBe(entry.id)
  })

  it('counts only what the retailer is still owed an outcome on', async () => {
    const queue = harness(async () => ({}))
    queue.enqueue(ACTIVATION)
    expect(queue.unsettledCount()).toBe(1)

    await queue.flush()
    expect(queue.unsettledCount()).toBe(0)
  })
})
