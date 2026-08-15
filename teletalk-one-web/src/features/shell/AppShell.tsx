import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { applyLang } from '../../i18n'
import type { Lang } from '../../i18n/format'
import { useAuth, useSession } from '../auth/AuthProvider'
import { useTheme } from '../../app/ThemeProvider'
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
  const { signOut } = useAuth()
  const { theme, cycle } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()

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
          <button
            type="button"
            className="iconbtn"
            aria-label={`${t('nav.notifications')} — ${t('nav.unread', { count: 3 })}`}
          >
            <Icon name="bell" size={20} />
            <span className="iconbtn__badge" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="chip chip--compact hide-sm"
            onClick={() => applyLang(nextLang)}
            lang={nextLang}
            aria-label={`${t('lang.label')}: ${t('lang.switchTo')}`}
          >
            {t('lang.switchTo')}
          </button>

          <button
            type="button"
            className="chip chip--compact hide-sm"
            onClick={cycle}
            aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
          >
            {theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
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
                  onClick={() => applyLang(nextLang)}
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
                  <Icon name="contrast" size={18} />
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
