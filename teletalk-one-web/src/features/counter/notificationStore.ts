import { useEffect, useSyncExternalStore } from 'react'
import { logger } from '../../lib/logger'
import { getNotifications, markNotificationsRead } from './counterApi'
import type { NotificationItem } from './counterTypes'

/**
 * The notification feed as a small external store, for one reason: **two
 * components need the same answer.** The bell in the top bar shows the unread
 * count and the notifications screen marks things read, and they are on
 * opposite sides of the router. A hook per component would have the badge
 * still showing three after the retailer had just read all three.
 *
 * Same shape as the outbox, and for the same reason — it outlives the
 * components that read it.
 */

let items: NotificationItem[] = []
let loaded = false
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(next: NotificationItem[]): void {
  items = next
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function load(force = false): Promise<void> {
  if (inFlight) return inFlight
  if (loaded && !force) return
  inFlight = getNotifications()
    .then((next) => {
      loaded = true
      emit(next)
    })
    .catch((err: unknown) => {
      // A failed feed must not take the top bar down with it. The screen has
      // its own error state; the badge simply stays as it was.
      logger.warn('notification feed unavailable', { err })
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

async function markRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  // Optimistic: reading is not a transaction, and a badge that clears half a
  // second after the tap reads as a broken badge.
  emit(items.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)))
  try {
    emit(await markNotificationsRead(ids))
  } catch (err) {
    logger.warn('could not mark notifications read', { err })
  }
}

/** Sign-out: the feed carries the outlet's own business. */
function clear(): void {
  loaded = false
  emit([])
}

export const notificationStore = { subscribe, load, markRead, clear, get: () => items }

export function useNotifications(enabled = true): {
  items: NotificationItem[]
  unread: number
} {
  const snapshot = useSyncExternalStore(subscribe, notificationStore.get, notificationStore.get)

  useEffect(() => {
    if (enabled) void load()
  }, [enabled])

  return { items: snapshot, unread: snapshot.filter((n) => !n.read).length }
}
