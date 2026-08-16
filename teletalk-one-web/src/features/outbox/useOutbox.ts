import { useSyncExternalStore } from 'react'
import { outbox, type OutboxEntry } from '../../lib/outbox'

/**
 * React's view of the queue. `useSyncExternalStore` rather than a provider,
 * because the outbox outlives every component that reads it — a retailer can
 * queue an activation, navigate to the catalogue and sign out, and the queue
 * must not be unmounted along the way.
 */

export function useOutboxEntries(): OutboxEntry[] {
  return useSyncExternalStore(outbox.subscribe, outbox.list, outbox.list)
}

/** The one entry a screen is waiting on. Null until something is enqueued. */
export function useOutboxEntry(id: string | null): OutboxEntry | null {
  const entries = useOutboxEntries()
  if (!id) return null
  return entries.find((e) => e.id === id) ?? null
}

/** Mutations the retailer is still owed an outcome on. */
export function useUnsettledCount(): number {
  const entries = useOutboxEntries()
  return entries.filter((e) => e.status === 'pending' || e.status === 'inflight').length
}
