import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { applyLang } from '../../i18n'
import type { Lang } from '../../i18n/format'
import { useAuth, useSession } from '../auth/AuthProvider'
import { useTheme } from '../../app/ThemeProvider'
import { useNotifications } from '../counter/notificationStore'
import './shell.css'

const TABS = [
  { to: '/', icon: 'home', labelKey: 'nav.home', end: true },
  { to: '/services', icon: 'grid', labelKey: 'nav.services', end: false },
  { to: '/profile', icon: 'user', labelKey: 'nav.profile', end: false },
] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()
  const { can, signOut } = useAuth()
  const { theme, cycle } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const { unread } = useNotifications(can('notification.view'))
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Close the account menu on outside click and Escape. A menu that traps the
  // user is worse than no menu on a field device.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => setMenuOpen(false), [pathname])

  const go = (to: string) => {
    setMenuOpen(false)
    navigate(to)
  }

  const initial = session.name[lang].trim().charAt(0)
  const nextLang: Lang = lang === 'bn' ? 'en' : 'bn'

  return (
    <div className="app">
      <a className="skiplink" href="#main">
        {t('nav.skipToContent')}
      </a>

      <header className="topbar">
        <NavLink to="/" className="topbar__brand" aria-label={t('nav.home')}>
          <span className="topbar__wordmark">{t('app.name')}</span>
          <span className="topbar__pos identifier">BD {session.posCode}</span>
        </NavLink>

        {/* Primary navigation, desktop only — mobile uses the bottom bar. */}
        <nav className="topnav" aria-label={t('nav.primary')}>
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `topnav__link${isActive ? ' is-active' : ''}`}
            >
              {t(tab.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="topbar__actions">
          {/* Gated on the capability like everything else: a role that cannot
              read the feed does not get a bell that leads to a locked screen. */}
          {can('notification.view') && (
            <button
              type="button"
              className="iconbtn"
              onClick={() => navigate('/services/notifications')}
              aria-label={
                unread > 0
                  ? `${t('nav.notifications')} — ${t('nav.unread', { count: unread })}`
                  : t('nav.notifications')
              }
            >
              <Icon name="bell" size={20} />
              {unread > 0 && <span className="iconbtn__badge" aria-hidden="true" />}
            </button>
          )}

          {/* Symbols, not words. Two labelled chips in a top bar that also
              carries a wordmark, a POS code, a bell and an account control is
              four competing text elements; as icons they read as controls at a
              glance and stop crowding the outlet name.

              Both name what you will GET, not what you are in — the globe
              switches language, the moon takes you to dark. The words are
              still there for anyone who wants them: `title` on hover, the
              accessible name for a screen reader, and the account menu keeps
              full text items on mobile. */}
          <button
            type="button"
            className="iconbtn hide-sm"
            onClick={() => void applyLang(nextLang)}
            title={`${t('lang.label')}: ${t('lang.switchTo')}`}
            aria-label={`${t('lang.label')}: ${t('lang.switchTo')}`}
          >
            <Icon name="globe" size={20} />
          </button>

          <button
            type="button"
            className="iconbtn hide-sm"
            onClick={cycle}
            title={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
            aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
            aria-pressed={theme === 'dark'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
          </button>

          <div className="account">
            <button
              ref={triggerRef}
              type="button"
              className="account__trigger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={t('nav.account')}
            >
              <span className="account__avatar" aria-hidden="true">
                {initial}
              </span>
              <span className="account__name">{session.name[lang]}</span>
              <Icon name="chevron" size={16} />
            </button>

            {menuOpen && (
              <div ref={menuRef} className="account__menu" role="menu">
                <div className="account__head">
                  <p className="account__head-name">{session.ownerName[lang]}</p>
                  <p className="account__head-meta identifier">BD {session.posCode}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="account__item"
                  onClick={() => go('/profile')}
                >
                  <Icon name="user" size={18} />
                  {t('nav.profile')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="account__item"
                  onClick={() => go('/profile/password')}
                >
                  <Icon name="key" size={18} />
                  {t('nav.changePassword')}
                </button>
                {/* On mobile the language and theme chips move in here — the
                    top bar cannot hold them beside the account control. */}
                <button
                  type="button"
                  role="menuitem"
                  className="account__item show-sm"
                  onClick={() => void applyLang(nextLang)}
                  lang={nextLang}
                >
                  <Icon name="globe" size={18} />
                  {t('lang.switchTo')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="account__item show-sm"
                  onClick={cycle}
                >
                  <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
                  {theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="account__item account__item--danger"
                  onClick={() => void signOut()}
                >
                  <Icon name="logout" size={18} />
                  {t('login.signOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* tabIndex -1 so RouteAnnouncer can move focus here on navigation. */}
      <main id="main" className="app__main" tabIndex={-1}>
        <div className="app__inner">
          <Outlet />
        </div>
      </main>

      <nav className="bottomnav" aria-label={t('nav.primary')}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `bottomnav__link${isActive ? ' is-active' : ''}`}
          >
            <Icon name={tab.icon} size={22} />
            <span>{t(tab.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
