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
import { AppState, type AppStateStatus } from 'react-native'
import { env } from '../../env'
import { setUnauthorizedHandler } from '../../lib/http'
import { logger } from '../../lib/logger'
import { outbox } from '../../lib/outbox'
import { clearAllDrafts } from '../wizard/draft'
import * as api from './authApi'
import type { Capability, Session } from './authTypes'

/**
 * Session state, ported from the portal. Three things had to change for a
 * handset, and each is marked below:
 *
 *  - Idle is measured by **backgrounding**, not by mouse and key events. A
 *    phone has no pointer to move, and a retailer who is looking at a customer
 *    rather than the screen has not gone away.
 *  - There is no cross-tab broadcast, because there are no tabs.
 *  - Timers are plain `setTimeout`; `window` does not exist here.
 */

type Status = 'restoring' | 'authenticated' | 'anonymous'

interface AuthValue {
  status: Status
  session: Session | null
  /** True when the session ended because the app was left in the background. */
  endedByIdle: boolean
  signIn: (result: api.SignInResult) => void
  signOut: () => Promise<void>
  can: (capability: Capability) => boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('restoring')
  const [session, setSession] = useState<Session | null>(null)
  const [endedByIdle, setEndedByIdle] = useState(false)

  /** Seconds the current access token is good for; set by sign-in and restore. */
  const tokenLifetime = useRef(900)
  /** Epoch ms the app went to the background, or 0 while it is in front. */
  const backgroundedAt = useRef(0)

  const clearSession = useCallback((idle: boolean) => {
    // A half-entered e-SAF and a queued mutation both belong to the session
    // that raised them. Carrying either into the next sign-in would leave one
    // retailer's customer on another retailer's screen — and would post the
    // queued transaction under the wrong token. Nothing queued has reached the
    // server, so nothing is lost that cannot be redone; the outbox banner is
    // what makes sure they are told before they sign out.
    clearAllDrafts()
    outbox.clear()
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
    clearSession(false)
  }, [clearSession])

  const signIn = useCallback((result: api.SignInResult) => {
    tokenLifetime.current = result.tokens.expiresIn
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
          tokenLifetime.current = result.tokens.expiresIn
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

  /* --------------------- refresh before expiry --------------------- */

  /**
   * The access token is short-lived, and the only thing that would otherwise
   * notice is a 401 — which arrives *during* whatever the retailer was doing.
   * At a counter that means an e-SAF thrown away at the biometric step because
   * a timer ran out between two keystrokes.
   *
   * So refresh early: at 80% of the token's life, or a minute before expiry,
   * whichever comes first. A failure here is not a crisis — the 401 handler is
   * still there — so it is logged and retried at half the remaining window
   * rather than ending the session.
   */
  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const arm = (expiresInSeconds: number) => {
      const lifetime = Math.max(expiresInSeconds, 30) * 1000
      const lead = Math.min(lifetime * 0.2, 60_000)
      timer = setTimeout(
        () => {
          api
            .refreshTokens()
            .then((next) => {
              if (!cancelled) arm(next.expiresIn)
            })
            .catch((err: unknown) => {
              // Leave the session alone. Either the next request succeeds on
              // the token we still hold, or its 401 ends things cleanly.
              logger.warn('token refresh failed; falling back to the 401 path', { err })
              if (!cancelled) arm(Math.max(expiresInSeconds / 2, 30))
            })
        },
        Math.max(lifetime - lead, 5_000),
      )
    }

    arm(tokenLifetime.current)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [status])

  /* ------------------- 401 anywhere ends the session ------------------- */

  useEffect(() => {
    setUnauthorizedHandler(() => clearSession(false))
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  /* ------------------------- idle timeout ------------------------- */

  /**
   * Idle on a handset is time spent *away* from the app, measured across the
   * background transition — not a timer ticking while the screen is up.
   *
   * The portal armed a timeout on every pointer and key event because a counter
   * PC is walked away from mid-task. A phone is not: it is put in a pocket, and
   * the OS may freeze our timers the moment it is. So the elapsed time is
   * computed on the way back in, which is both accurate and cheap — and it
   * still ends the session of a phone left on a shop counter, which is the risk
   * the portal's timeout was written for.
   */
  useEffect(() => {
    if (status !== 'authenticated') return

    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        const away = backgroundedAt.current === 0 ? 0 : Date.now() - backgroundedAt.current
        backgroundedAt.current = 0
        if (away >= env.idleTimeoutMs) {
          logger.debug('session ended by idle timeout')
          void api.signOut().catch(() => undefined)
          clearSession(true)
        }
      } else if (backgroundedAt.current === 0) {
        backgroundedAt.current = Date.now()
      }
    }

    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [status, clearSession])

  const capabilities = useMemo(() => new Set(session?.capabilities ?? []), [session?.capabilities])

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

/** Narrowed hook for screens that are already behind the signed-in navigator. */
export function useSession(): Session {
  const { session } = useAuth()
  if (!session) throw new Error('useSession used outside an authenticated screen')
  return session
}
