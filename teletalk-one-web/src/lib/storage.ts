/**
 * Storage that never throws. Private browsing, disabled cookies and locked-down
 * enterprise devices all make localStorage access throw rather than return null.
 *
 * Only NON-SENSITIVE preferences belong here — language, theme, last POS code
 * for convenience. Never tokens, never customer data, never NID.
 */

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — preferences simply don't persist */
  }
}

export function removeLocal(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const StorageKeys = {
  lang: 'teletalk.lang',
  theme: 'teletalk.theme',
  lastPos: 'teletalk.lastPos',
} as const
