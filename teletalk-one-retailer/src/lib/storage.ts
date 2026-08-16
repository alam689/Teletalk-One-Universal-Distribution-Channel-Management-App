import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { logger } from './logger'

/**
 * Storage, made synchronous.
 *
 * The outbox and the wizard drafts were written against `sessionStorage` — a
 * synchronous read inside a reducer, a synchronous write on every change. React
 * Native has no such thing: AsyncStorage and SecureStore both return promises.
 *
 * Rewriting those modules around promises would mean an `await` in the middle
 * of the queue's flush loop and a render that cannot tell "empty" from "not
 * loaded yet". So the asynchrony is moved to one place instead: every store is
 * read **once** into memory at boot, reads are served from that map, and writes
 * go to memory first and to the device after. `hydrate()` is awaited before the
 * first screen mounts, which is what makes the synchronous read honest.
 *
 * The cost is bounded and known: a write that the OS kills within a few
 * milliseconds is lost. For a queued mutation that means it is re-entered by
 * hand — the same outcome as the app being killed one moment earlier.
 */

export interface SyncStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
  /** Everything this store holds. Sign-out empties the vault with it. */
  clear(): void
}

type Backend = {
  read(key: string): Promise<string | null>
  write(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

const asyncBackend: Backend = {
  read: (key) => AsyncStorage.getItem(key),
  write: (key, value) => AsyncStorage.setItem(key, value),
  delete: (key) => AsyncStorage.removeItem(key),
}

/**
 * SecureStore is the Keychain on iOS and Keystore-backed shared preferences on
 * Android. It has **no web implementation** — Expo web would throw. The web
 * target here exists so the app can be driven in a browser during development,
 * so it degrades to AsyncStorage and says so out loud. Nothing ships to a
 * retailer through the web target.
 */
const secureBackend: Backend =
  Platform.OS === 'web'
    ? {
        read: (key) => {
          logger.warn('secure storage unavailable on web — falling back', { key })
          return AsyncStorage.getItem(key)
        },
        write: (key, value) => AsyncStorage.setItem(key, value),
        delete: (key) => AsyncStorage.removeItem(key),
      }
    : {
        read: (key) => SecureStore.getItemAsync(key),
        write: (key, value) => SecureStore.setItemAsync(key, value),
        delete: (key) => SecureStore.deleteItemAsync(key),
      }

function createStore(backend: Backend, keys: readonly string[]): SyncStore & {
  hydrate: () => Promise<void>
} {
  const cache = new Map<string, string>()
  /** Serialises writes per key, so two rapid `set`s cannot land out of order. */
  let tail: Promise<unknown> = Promise.resolve()

  const queue = (fn: () => Promise<unknown>) => {
    tail = tail.then(fn).catch((err) => logger.warn('storage write failed', { err }))
  }

  return {
    async hydrate() {
      await Promise.all(
        keys.map(async (key) => {
          try {
            const value = await backend.read(key)
            if (value !== null) cache.set(key, value)
          } catch (err) {
            // A corrupt or unreadable entry must not stop the app booting.
            logger.warn('storage read failed', { key, err })
          }
        }),
      )
    },
    get: (key) => cache.get(key) ?? null,
    set(key, value) {
      cache.set(key, value)
      queue(() => backend.write(key, value))
    },
    remove(key) {
      cache.delete(key)
      queue(() => backend.delete(key))
    },
    clear() {
      const held = [...cache.keys()]
      cache.clear()
      queue(() => Promise.all(held.map((key) => backend.delete(key))))
    },
  }
}

/**
 * Every key in the app, declared. A store can only hydrate keys it knows about,
 * so an undeclared key would read as absent on the first render after a restart
 * and then quietly appear — the kind of bug that only shows up on a real device
 * on a bad day.
 */
export const PrefKeys = {
  lang: 'teletalk.lang',
  theme: 'teletalk.theme',
  /** POS code of the last sign-in. Prefills the field; never a credential. */
  lastPos: 'teletalk.lastPos',
} as const

export const VaultKeys = {
  session: 'teletalk.session',
  outbox: 'teletalk.outbox',
  draft: 'teletalk.draft',
  /**
   * The mock's stand-in for the refresh token. Declared here with the rest
   * because a key the store does not know about is a key it cannot hydrate:
   * it would read as absent on the first render after a restart and then
   * quietly appear — a bug that only shows up on a real device on a bad day.
   */
  mockPos: 'teletalk.mock.pos',
  mockTrust: 'teletalk.mock.trusted',
} as const

/** Language, theme, last POS code. Nothing here identifies a customer. */
export const prefs = createStore(asyncBackend, Object.values(PrefKeys))

/**
 * The session, the outbox and the wizard drafts.
 *
 * All three hold customer data: a queued activation body carries an NID, and a
 * draft carries one before it is even submitted. On the web these lived in
 * `sessionStorage` because the counter terminal is shared; on a phone the
 * equivalent protection is the OS keystore, which is what this is.
 */
export const vault = createStore(secureBackend, Object.values(VaultKeys))

/** Awaited once, before the first screen mounts. */
export function hydrateStorage(): Promise<void> {
  return Promise.all([prefs.hydrate(), vault.hydrate()]).then(() => undefined)
}
