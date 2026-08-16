import NetInfo from '@react-native-community/netinfo'
import { useSyncExternalStore } from 'react'

/**
 * Connectivity, as one fact the whole app reads.
 *
 * The web portal asks `navigator.onLine`, which answers "is there a network
 * interface" — on a phone that is almost always yes and almost always useless.
 * NetInfo can answer the question that matters, `isInternetReachable`: the
 * handset is on a tower, the tower is not passing traffic. That is the normal
 * failure in the field, and it is the one the portal could not see.
 *
 * `isInternetReachable` is `null` until the first probe completes. Null is
 * treated as online: refusing to send because we have not finished checking
 * would make the app feel broken at launch, and a send that fails offline costs
 * nothing — the outbox holds it and gives the attempt back.
 */

let online = true
const listeners = new Set<() => void>()

function set(next: boolean): void {
  if (next === online) return
  online = next
  for (const fn of listeners) fn()
}

NetInfo.addEventListener((state) => {
  set(state.isConnected !== false && state.isInternetReachable !== false)
})

export function isOnline(): boolean {
  return online
}

/** For tests and for the dev-only offline switch on the profile screen. */
export function setOnlineForTesting(value: boolean): void {
  set(value)
}

/** Fires on every flip. The outbox uses it to wake when the tower returns. */
export function subscribeOnline(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Drives the offline banner. Re-renders only when the state actually flips. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline, isOnline)
}
