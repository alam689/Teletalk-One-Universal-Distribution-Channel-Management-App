import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthProvider } from '../features/auth/AuthProvider'
import { AppShell } from '../features/shell/AppShell'
import { RequireAuth } from './RequireAuth'
import { RouteAnnouncer } from './RouteAnnouncer'
import { OfflineBanner } from './OfflineBanner'
import { OutboxBanner } from '../features/outbox/OutboxBanner'
import { FLOW_IDS } from '../features/activation/flowSpec'
import { SALE_IDS } from '../features/recharge/saleSpec'
import { DESK_IDS } from '../features/lifting/deskSpec'
import { LoginPage } from '../features/auth/LoginPage'

// Route-level splitting: the sign-in bundle is what a cold retailer device
// downloads first, so the authenticated screens stay out of it.
const HomePage = lazy(() => import('../features/home/HomePage'))
const ServicesPage = lazy(() => import('../features/home/ServicesPage'))
const ModulePage = lazy(() => import('../features/home/ModulePage'))
// The counter transactions are their own chunk: the whole wizard, e-SAF and
// queue never reach a device whose role cannot run one.
const FlowPage = lazy(() => import('../features/activation/FlowPage'))
const SalePage = lazy(() => import('../features/recharge/SalePage'))

// The Phase-1 read screens. One chunk each — a retailer who only ever sells
// recharge should not download the sales report to find that out.
const TransactionsPage = lazy(() => import('../features/counter/TransactionsPage'))
const StockPage = lazy(() => import('../features/counter/StockPage'))
const CommissionPage = lazy(() => import('../features/counter/CommissionPage'))
const SalesReportPage = lazy(() => import('../features/counter/SalesReportPage'))
const CustomerSearchPage = lazy(() => import('../features/counter/CustomerSearchPage'))
const NotificationsPage = lazy(() => import('../features/counter/NotificationsPage'))
const SupportPage = lazy(() => import('../features/counter/SupportPage'))
const CommissionStatementPage = lazy(
  () => import('../features/counter/CommissionStatementPage'),
)
const OutstandingPage = lazy(() => import('../features/counter/OutstandingPage'))
const TargetPage = lazy(() => import('../features/counter/TargetPage'))
const CampaignsPage = lazy(() => import('../features/counter/CampaignsPage'))
const OffersPage = lazy(() => import('../features/counter/OffersPage'))
const MnpStatusPage = lazy(() => import('../features/activation/MnpStatusPage'))
const ChoiceNumberPage = lazy(() => import('../features/activation/ChoiceNumberPage'))

// The distribution chain. Its own chunk: a retailer never opens any of it.
const LiftingDeskPage = lazy(() => import('../features/lifting/LiftingDeskPage'))
const InventoryPage = lazy(() => import('../features/lifting/InventoryPage'))
const SrRoutePage = lazy(() => import('../features/lifting/SrRoutePage'))
const SrAllocationPage = lazy(() => import('../features/lifting/SrAllocationPage'))

// Outlet operations and channel management — the FE-4 tiles.
const RequisitionPage = lazy(() => import('../features/ops/RequisitionPage'))
const ComplaintPage = lazy(() => import('../features/ops/ComplaintPage'))
const Customer360Page = lazy(() => import('../features/ops/Customer360Page'))
const PerformancePage = lazy(() => import('../features/ops/PerformancePage'))
const MoneyPages = lazy(() => import('../features/ops/MoneyPagesRoutes'))
const StockOpsPages = lazy(() => import('../features/ops/StockOpsRoutes'))
const ChannelPages = lazy(() => import('../features/channel/ChannelRoutes'))

/**
 * Built read screens, by menu id. The catalogue tile and the route are the
 * same id by construction, so a screen cannot be reachable from a tile that
 * points somewhere else.
 */
const COUNTER_SCREENS: Record<string, JSX.Element> = {
  transactions: <TransactionsPage />,
  simStock: <StockPage type="sim" />,
  productStock: <StockPage type="product" />,
  commission: <CommissionPage />,
  salesReport: <SalesReportPage />,
  customerSearch: <CustomerSearchPage />,
  notifications: <NotificationsPage />,
  support: <SupportPage />,
  commissionStatement: <CommissionStatementPage />,
  outstanding: <OutstandingPage />,
  target: <TargetPage />,
  campaigns: <CampaignsPage />,
  myCampaign: <CampaignsPage ownOnly />,
  offers: <OffersPage />,
  mnpStatus: <MnpStatusPage />,
  choiceNumber: <ChoiceNumberPage />,
  centralInventory: <InventoryPage scope="central" />,
  zonalInventory: <InventoryPage scope="zonal" />,
  srRoute: <SrRoutePage />,
  srAllocation: <SrAllocationPage />,
  requisition: <RequisitionPage mode="raise" />,
  requisitionApprove: <RequisitionPage mode="approve" />,
  complaintCreate: <ComplaintPage mode="create" />,
  complaintTrack: <ComplaintPage mode="track" />,
  customer360: <Customer360Page />,
  performance: <PerformancePage />,
  wallet: <MoneyPages screen="wallet" />,
  paymentCollect: <MoneyPages screen="collect" />,
  settlement: <MoneyPages screen="settlement" />,
  subsidy: <MoneyPages screen="subsidy" />,
  stockReturn: <StockOpsPages screen="return" />,
  stockTransfer: <StockOpsPages screen="transfer" />,
  stockReconcile: <StockOpsPages screen="reconcile" />,
  retailerManage: <ChannelPages screen="manage" />,
  retailerOnboard: <ChannelPages screen="onboard" />,
  retailerProvision: <ChannelPages screen="provision" />,
  userManage: <ChannelPages screen="users" />,
  territory: <ChannelPages screen="territory" />,
  fieldVisit: <ChannelPages screen="visit" />,
  posm: <ChannelPages screen="posm" />,
  geofence: <ChannelPages screen="geofence" />,
  deviceMonitor: <ChannelPages screen="devices" />,
}
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
      <OutboxBanner />
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
                // Built flows take their static path ahead of the stub route.
                // React Router ranks static segments above dynamic ones, so the
                // order here is documentation, not load-bearing.
                ...FLOW_IDS.map((id) => ({
                  path: `/services/${id}`,
                  element: <FlowPage flowId={id} />,
                })),
                ...SALE_IDS.map((id) => ({
                  path: `/services/${id}`,
                  element: <SalePage saleId={id} />,
                })),
                ...DESK_IDS.map((id) => ({
                  path: `/services/${id}`,
                  element: <LiftingDeskPage deskId={id} />,
                })),
                ...Object.entries(COUNTER_SCREENS).map(([id, element]) => ({
                  path: `/services/${id}`,
                  element,
                })),
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
