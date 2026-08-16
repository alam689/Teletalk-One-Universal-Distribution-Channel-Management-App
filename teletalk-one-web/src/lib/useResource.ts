import { useCallback, useEffect, useRef, useState } from 'react'
import { errorKey } from './http'
import { logger } from './logger'

/**
 * One fetch-on-mount hook for every read screen.
 *
 * It exists because the alternative — `useEffect` plus three `useState`s in
 * each of a dozen screens — gets three things wrong every time it is written
 * out by hand, and all three matter on a counter phone:
 *
 *  1. **Abort on unmount and on key change.** A retailer tapping through the
 *     catalogue leaves a trail of in-flight requests, and the slow one landing
 *     last overwrites the screen they are actually on.
 *  2. **An error is a key, not a boolean.** The screen shows the remedy the
 *     server named, not "something went wrong".
 *  3. **Reload is part of the contract.** Every one of these screens is
 *     reachable while the tower is down, so every one needs a retry.
 *
 * `key` rather than a deps array: it keeps the dependency honest (it is what
 * the request is *for*), and it keeps the exhaustive-deps lint rule useful
 * instead of suppressed.
 */

export interface Resource<T> {
  data: T | null
  /** `error.*` i18n key. Null while loading or on success. */
  error: string | null
  loading: boolean
  reload: () => void
}

export function useResource<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  // The fetcher is almost always an inline arrow, so it is a new function on
  // every render. Holding it in a ref keeps the effect keyed on `key` alone.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    setLoading(true)
    setError(null)

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!live) return
        setData(result)
      })
      .catch((err: unknown) => {
        if (!live || controller.signal.aborted) return
        logger.warn('resource failed', { key, err })
        setError(errorKey(err))
      })
      .finally(() => {
        if (live) setLoading(false)
      })

    return () => {
      live = false
      controller.abort()
    }
  }, [key, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { data, error, loading, reload }
}
