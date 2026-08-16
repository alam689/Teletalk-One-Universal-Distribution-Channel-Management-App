import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const TITLES: Record<string, string> = {
  '/': 'nav.home',
  '/services': 'nav.services',
  '/profile': 'nav.profile',
  '/profile/password': 'nav.changePassword',
  '/login': 'login.heading',
}

/**
 * A single-page app doesn't reload, so screen readers get no signal that the
 * screen changed and keyboard focus stays wherever it was. This restores both,
 * and keeps the document title in step for browser history and tab labels.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const live = useRef<HTMLParagraphElement>(null)
  const first = useRef(true)

  useEffect(() => {
    // A module or flow route announces the service by name, not "Services" —
    // a retailer switching tabs mid-activation needs to see which one it is.
    // An unknown id falls back rather than announcing a raw i18n key.
    const moduleId = pathname.startsWith('/services/') ? pathname.slice('/services/'.length) : ''
    const itemKey = moduleId && !moduleId.includes('/') ? `item.${moduleId}` : null
    const key =
      TITLES[pathname] ??
      (itemKey && t(itemKey) !== itemKey ? itemKey : null) ??
      (pathname.startsWith('/services/') ? 'nav.services' : null)
    const name = key ? t(key) : ''
    document.title = name ? `${name} — ${t('app.name')}` : t('app.name')

    // Don't announce or move focus on first paint; the user just arrived.
    if (first.current) {
      first.current = false
      return
    }

    if (live.current) live.current.textContent = name

    // Move focus to the top of the new screen, not into it.
    const main = document.getElementById('main')
    main?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, t])

  return <p ref={live} className="visually-hidden" role="status" aria-live="polite" />
}
