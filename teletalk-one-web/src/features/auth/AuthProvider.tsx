import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { env } from '../../env'
import { setUnauthorizedHandler } from '../../lib/http'
import { logger } from '../../lib/logger'
import * as api from './authApi'
import type { Capability, Session } from './authTypes'

type Status = 'restoring' | 'authenticated' | 'anonymous'

interface AuthValue {
  status: Status
  session: Session | null
  /** True when the session ended because the counter was left idle. */
  endedByIdle: boolean
  signIn: (result: api.SignInResult) => void
  signOut: () => Promise<void>
  can: (capability: Capability) => boolean
}

const AuthContext = createContext<AuthValue | null>(null)

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'visibilitychange'] as const
const SIGNOUT_BROADCAST = 'teletalk.signout'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('restoring')
  const [session, setSession] = useState<Session | null>(null)
  const [endedByIdle, setEndedByIdle] = useState(false)

  const idleTimer = useRef<number | undefined>(undefined)

  const clearSession = useCallback((idle: boolean) => {
    window.clearTimeout(idleTimer.current)
    setSession(null)
    setStatus('anonymous')
    setEndedByIdle(idle)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.signOut()
    } catch (err) {
      logger.warn('sign-out call failed; clearing locally anyway', { err })
    }
    // Other tabs on the same shared terminal must drop the session too.
    try {
      localStorage.setItem(SIGNOUT_BROADCAST, String(Date.now()))
      localStorage.removeItem(SIGNOUT_BROADCAST)
    } catch {
      /* ignore */
    }
    clearSession(false)
  }, [clearSession])

  const signIn = useCallback((result: api.SignInResult) => {
    setSession(result.session)
    setStatus('authenticated')
    setEndedByIdle(false)
  }, [])

  /* ----------------------- restore on boot ----------------------- */

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    api
      .restoreSession(controller.signal)
      .then((result) => {
        if (cancelled) return
        if (result) {
          setSession(result.session)
          setStatus('authenticated')
        } else {
          setStatus('anonymous')
        }
      })
      .catch((err) => {
        if (cancelled) return
        logger.error('session restore failed', err)
        setStatus('anonymous')
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  /* ------------------- 401 anywhere ends the session ------------------- */

  useEffect(() => {
    setUnauthorizedHandler(() => clearSession(false))
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  /* ------------------------- idle timeout ------------------------- */

  useEffect(() => {
    if (status !== 'authenticated') return

    const arm = () => {
      window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => {
        logger.debug('session ended by idle timeout')
        void api.signOut().catch(() => undefined)
        clearSession(true)
      }, env.idleTimeoutMs)
    }

    arm()
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, arm, { passive: true })
    return () => {
      window.clearTimeout(idleTimer.current)
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, arm)
    }
  }, [status, clearSession])

  /* --------------------- cross-tab sign-out --------------------- */

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIGNOUT_BROADCAST && e.newValue) clearSession(false)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [clearSession])

  const capabilities = useMemo(
    () => new Set(session?.capabilities ?? []),
    [session?.capabilities],
  )

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      endedByIdle,
      signIn,
      signOut,
      can: (c) => capabilities.has(c),
    }),
    [status, session, endedByIdle, signIn, signOut, capabilities],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Narrowed hook for screens that are already behind <RequireAuth>. */
export function useSession(): Session {
  const { session } = useAuth()
  if (!session) throw new Error('useSession used outside an authenticated route')
  return session
}
