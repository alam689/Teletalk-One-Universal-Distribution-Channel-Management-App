import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/AuthProvider'

/**
 * Route guard. While the session is being restored it renders a hold rather
 * than redirecting — otherwise a page refresh bounces the user to sign-in and
 * loses their deep link.
 */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (status === 'restoring') {
    return (
      <div className="boot" role="status" aria-live="polite">
        <span className="boot__spinner" aria-hidden="true" />
        <span className="boot__label">{t('app.restoring')}</span>
      </div>
    )
  }

  if (status === 'anonymous') {
    // `from` lets sign-in return the user to where they were headed.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
