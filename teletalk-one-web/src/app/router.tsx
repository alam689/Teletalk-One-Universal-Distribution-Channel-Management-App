import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthProvider } from '../features/auth/AuthProvider'
import { AppShell } from '../features/shell/AppShell'
import { RequireAuth } from './RequireAuth'
import { RouteAnnouncer } from './RouteAnnouncer'
import { OfflineBanner } from './OfflineBanner'
import { LoginPage } from '../features/auth/LoginPage'

// Route-level splitting: the sign-in bundle is what a cold retailer device
// downloads first, so the authenticated screens stay out of it.
const HomePage = lazy(() => import('../features/home/HomePage'))
const ServicesPage = lazy(() => import('../features/home/ServicesPage'))
const ModulePage = lazy(() => import('../features/home/ModulePage'))
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'))
const ChangePasswordPage = lazy(() => import('../features/profile/ChangePasswordPage'))
const NotFoundPage = lazy(() => import('./NotFoundPage'))

function Fallback() {
  const { t } = useTranslation()
  return (
    <div className="boot" role="status" aria-live="polite">
      <span className="boot__spinner" aria-hidden="true" />
      <span className="boot__label">{t('app.loading')}</span>
    </div>
  )
}

function Root() {
  return (
    <AuthProvider>
      <RouteAnnouncer />
      <OfflineBanner />
      <Suspense fallback={<Fallback />}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  )
}

export const router = createBrowserRouter(
  [
    {
      element: <Root />,
      children: [
        { path: '/login', element: <LoginPage /> },
        {
          element: <RequireAuth />,
          children: [
            {
              element: <AppShell />,
              children: [
                { path: '/', element: <HomePage /> },
                { path: '/services', element: <ServicesPage /> },
                { path: '/services/:moduleId', element: <ModulePage /> },
                { path: '/profile', element: <ProfilePage /> },
                { path: '/profile/password', element: <ChangePasswordPage /> },
              ],
            },
          ],
        },
        { path: '/index.html', element: <Navigate to="/" replace /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  {
    // Opt in early so the v7 upgrade is a version bump, not a behaviour change.
    // v7_startTransition belongs on <RouterProvider>, not here.
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
)
