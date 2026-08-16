import { ApiError, errorKey, request } from './http'
import { logger } from './logger'
import { isOnline, subscribeOnline as subscribeNetwork } from './net'
import { vault, VaultKeys, type SyncStore } from './storage'

/**
 * The offline outbox.
 *
 * Field connectivity is the first challenge the S&D deck lists, and the failure
 * it produces is not "the request failed" — it is the retailer pressing
 * *Recharge* a second time because the first one appeared to do nothing, and
 * the customer being charged twice. On a handset in a bazaar this is not the
 * edge case it was on the counter PC; it is Tuesday.
 *
 * Three rules follow, and they are the whole design:
 *
 *  1. **Every mutation carries an idempotency key, generated once at enqueue.**
 *     A retry reuses it, so the server can replay the original response instead
 *     of doing the work twice. That is what makes "settles exactly once" true
 *     rather than hoped for.
 *  2. **The queue holds intent, never outcome.** A recharge is `pending` until
 *     the server confirms it. Nothing may render a queued financial mutation as
 *     done — see `OutboxStatus`.
 *  3. **Only transient failures retry.** A rejected NID does not get better on
 *     the fourth attempt; it needs the retailer, so it fails terminally and
 *     surfaces a remedy.
 *
 * This is the portal's outbox with two substitutions: the store is injected
 * rather than assumed to be `sessionStorage`, and reachability comes from
 * NetInfo. The queue logic underneath is unchanged, deliberately — it is the
 * part that has tests against it.
 */

export type OutboxStatus =
  /** Accepted locally, not yet confirmed by the server. Never render as done. */
  | 'pending'
  /** A request is in flight right now. */
  | 'inflight'
  /** The server confirmed it. `result` holds the response. */
  | 'settled'
  /** Terminally rejected. `errorKey` carries the remedy; needs the retailer. */
  | 'failed'

export interface OutboxEntry {
  /** Also the idempotency key. Generated once; every retry reuses it. */
  id: string
  /** Domain label — `activation`, `recharge`. Drives the UI's wording. */
  kind: string
  path: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body: unknown
  status: OutboxStatus
  attempts: number
  queuedAt: number
  /** Epoch ms; a pending entry is not tried again before this. */
  nextAttemptAt: number
  /** `error.*` i18n key, set when the entry failed. */
  errorKey?: string
  result?: unknown
}

/** Failures worth trying again. Everything else needs a human. */
const TRANSIENT = new Set(['offline', 'network', 'timeout', 'server', 'rateLimited'])

const MAX_ATTEMPTS = 5
const MAX_BACKOFF_MS = 60_000
/** Fallback poll while offline; the NetInfo subscription is the real wake-up. */
const OFFLINE_RECHECK_MS = 30_000
/** A settled receipt stays readable across a restart for this long. */
const SETTLED_TTL_MS = 60 * 60 * 1000

export type Sender = (entry: OutboxEntry) => Promise<unknown>

export interface OutboxOptions {
  send?: Sender
  now?: () => number
  /** Milliseconds to wait before attempt N (0-based). Injected in tests. */
  backoff?: (attempt: number, retryAfterSec?: number) => number
  /** Where the queue survives a restart. Defaults to the OS keystore. */
  store?: SyncStore
  storageKey?: string
  /** Reachability. Injected in tests; NetInfo in the app. */
  online?: () => boolean
  /** Notifies when reachability flips. Injected in tests. */
  subscribeOnline?: (fn: () => void) => () => void
  /** Off in tests, where flushing is driven explicitly. */
  autoFlush?: boolean
}

function defaultBackoff(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec !== undefined) return Math.min(retryAfterSec * 1000, MAX_BACKOFF_MS)
  const base = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS)
  // Jitter, so a zonal outage does not produce a synchronised retry stampede
  // from every retailer the moment the tower comes back.
  return base / 2 + Math.random() * (base / 2)
}

/**
 * The idempotency key.
 *
 * Hermes has no `crypto.randomUUID`, so unlike the portal this is the fallback
 * path by default. It does not need to be unguessable — it is generated on the
 * device, sent over TLS, and only ever matched against this retailer's own
 * queue. It needs to not collide, and time plus 40 bits of randomness does not.
 */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const defaultSend: Sender = (entry) =>
  request<unknown>(entry.path, {
    method: entry.method,
    body: entry.body,
    retries: 0, // Retrying is the queue's job, and it owns the backoff.
    headers: { 'Idempotency-Key': entry.id },
  })

export interface EnqueueInput {
  kind: string
  path: string
  method?: OutboxEntry['method']
  body: unknown
  /** Supply to make an enqueue idempotent across a double tap. */
  id?: string
}

export function createOutbox(options: OutboxOptions = {}) {
  const {
    send: configuredSend = defaultSend,
    now = () => Date.now(),
    backoff = defaultBackoff,
    store = vault,
    storageKey = VaultKeys.outbox,
    online = isOnline,
    subscribeOnline = subscribeNetwork,
    autoFlush = true,
  } = options

  let send = configuredSend
  let entries: OutboxEntry[] = []
  const listeners = new Set<() => void>()
  let flushing = false
  let timer: ReturnType<typeof setTimeout> | undefined
  /** Replaced on every change so `useSyncExternalStore` sees a new snapshot. */
  let snapshot: OutboxEntry[] = []

  /* ------------------------------ storage ------------------------------ *
   * The keystore, because a queued activation body carries the customer's NID
   * and a handset is lost, resold and repaired. `storage.ts` hydrates it into
   * memory before the first screen mounts, which is what lets these stay
   * synchronous.
   * -------------------------------------------------------------------- */

  function load(): void {
    try {
      const raw = store.get(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as OutboxEntry[]
      if (!Array.isArray(parsed)) return
      entries = parsed
        .filter((e) => e.status !== 'settled' || now() - e.queuedAt < SETTLED_TTL_MS)
        // The app died mid-request and left an entry inflight. It is pending:
        // the idempotency key makes re-sending it safe.
        .map((e) => (e.status === 'inflight' ? { ...e, status: 'pending' as const } : e))
    } catch (err) {
      logger.warn('unreadable outbox discarded', { err })
      entries = []
    }
  }

  function persist(): void {
    try {
      store.set(storageKey, JSON.stringify(entries))
    } catch {
      /* full disk or a locked keystore — the queue still works in memory */
    }
  }

  function emit(): void {
    snapshot = [...entries]
    persist()
    for (const fn of listeners) fn()
  }

  function patch(id: string, changes: Partial<OutboxEntry>): void {
    entries = entries.map((e) => (e.id === id ? { ...e, ...changes } : e))
    emit()
  }

  /* ------------------------------- queue ------------------------------- */

  function enqueue(input: EnqueueInput): OutboxEntry {
    const id = input.id ?? newIdempotencyKey()
    const existing = entries.find((e) => e.id === id)
    // A double tap must not queue the work twice, even before the network is
    // involved. Same key in, same entry out.
    if (existing) return existing

    const entry: OutboxEntry = {
      id,
      kind: input.kind,
      path: input.path,
      method: input.method ?? 'POST',
      body: input.body,
      status: 'pending',
      attempts: 0,
      queuedAt: now(),
      nextAttemptAt: now(),
    }
    entries = [...entries, entry]
    emit()
    if (autoFlush) void flush()
    return entry
  }

  function due(): OutboxEntry | undefined {
    return entries.find((e) => e.status === 'pending' && e.nextAttemptAt <= now())
  }

  async function flush(): Promise<void> {
    if (flushing) return
    // Offline is not a failure to be absorbed by the retry budget — it is a
    // state to wait out. The NetInfo subscription wakes the queue.
    if (!online()) return
    flushing = true
    try {
      // Sequential on purpose. Stock movements and financial postings must
      // reach the server in the order the retailer performed them.
      for (let entry = due(); entry; entry = due()) {
        patch(entry.id, { status: 'inflight', attempts: entry.attempts + 1 })
        const attempts = entry.attempts + 1
        try {
          const result = await send(entry)
          patch(entry.id, { status: 'settled', result, errorKey: undefined })
        } catch (err) {
          const code = err instanceof ApiError ? err.code : 'generic'
          if (code === 'offline') {
            // Connectivity dropped between the check above and the send. Give
            // the attempt back: waiting is not a failed try.
            patch(entry.id, {
              status: 'pending',
              attempts: entry.attempts,
              nextAttemptAt: now() + OFFLINE_RECHECK_MS,
            })
            break
          }
          const retryable = TRANSIENT.has(code) && attempts < MAX_ATTEMPTS
          if (retryable) {
            const retryAfter = err instanceof ApiError ? err.retryAfter : undefined
            patch(entry.id, {
              status: 'pending',
              nextAttemptAt: now() + backoff(attempts, retryAfter),
              errorKey: errorKey(err),
            })
            break // Nothing later goes ahead of a mutation that has not landed.
          }
          patch(entry.id, { status: 'failed', errorKey: errorKey(err) })
        }
      }
    } finally {
      flushing = false
      schedule()
    }
  }

  /** Wakes the queue when the earliest backoff expires. */
  function schedule(): void {
    if (!autoFlush) return
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    const waiting = entries.filter((e) => e.status === 'pending')
    if (waiting.length === 0) return
    const soonest = Math.min(...waiting.map((e) => e.nextAttemptAt))
    timer = setTimeout(() => void flush(), Math.max(0, soonest - now()))
  }

  /** Retailer-initiated. Clears the terminal state and tries once more. */
  function retry(id: string): void {
    const entry = entries.find((e) => e.id === id)
    if (!entry || entry.status !== 'failed') return
    patch(id, { status: 'pending', attempts: 0, nextAttemptAt: now(), errorKey: undefined })
    if (autoFlush) void flush()
  }

  /** Drops a settled receipt, or abandons a failed mutation. */
  function remove(id: string): void {
    entries = entries.filter((e) => e.id !== id)
    emit()
  }

  /** Sign-out. A queue holding a customer's NID must not outlive the session. */
  function clear(): void {
    entries = []
    emit()
  }

  function get(id: string): OutboxEntry | undefined {
    return entries.find((e) => e.id === id)
  }

  /** Entries the retailer is still owed an outcome on. */
  function unsettledCount(): number {
    return entries.filter((e) => e.status === 'pending' || e.status === 'inflight').length
  }

  function subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }

  /**
   * Reads the stored queue and starts the clock.
   *
   * Separate from construction, unlike the portal's, because the keystore is
   * hydrated asynchronously: a queue that loaded itself at import time would
   * read an empty cache and silently drop everything the retailer queued
   * before the app was killed. `App.tsx` calls this after `hydrateStorage()`,
   * and it is idempotent so a fast remount cannot double-subscribe.
   */
  let started = false
  function start(): () => void {
    if (started) return () => undefined
    started = true
    load()
    snapshot = [...entries]
    for (const fn of listeners) fn()
    schedule()
    // The tower came back. Nothing else in the app watches for this, and a
    // queue that only woke on its own backoff would sit out a five-minute
    // outage for another minute after it ended.
    return subscribeOnline(() => {
      if (online()) void flush()
    })
  }

  /**
   * Swaps the transport. The in-repo mock installs itself through here so a
   * queued recharge exercises the *same* queue, retry and idempotency path it
   * will use against Telepay — a separate mock queue would test nothing.
   */
  function setTransport(fn: Sender): void {
    send = fn
  }

  return {
    start,
    enqueue,
    flush,
    setTransport,
    retry,
    remove,
    clear,
    get,
    unsettledCount,
    subscribe,
    /** Stable reference between changes — required by useSyncExternalStore. */
    list: () => snapshot,
  }
}

export type Outbox = ReturnType<typeof createOutbox>

export const outbox: Outbox = createOutbox()
