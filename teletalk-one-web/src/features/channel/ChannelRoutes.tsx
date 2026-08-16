import { DeviceMonitorPage, TerritoryPage, UserManagePage } from './AdminPages'
import { FieldVisitPage, GeofencePage, PosmAuditPage } from './FieldPages'
import {
  RetailerManagePage,
  RetailerOnboardPage,
  RetailerProvisionPage,
} from './RetailerPages'

export type ChannelScreen =
  | 'manage'
  | 'onboard'
  | 'provision'
  | 'users'
  | 'territory'
  | 'visit'
  | 'posm'
  | 'geofence'
  | 'devices'

/**
 * Route entry for the nine channel-management screens. One chunk: these are
 * the tiles only head-office and field roles ever open, and a retailer should
 * not download an admin surface to find that out.
 */
export default function ChannelRoutes({ screen }: { screen: ChannelScreen }) {
  switch (screen) {
    case 'manage':
      return <RetailerManagePage />
    case 'onboard':
      return <RetailerOnboardPage />
    case 'provision':
      return <RetailerProvisionPage />
    case 'users':
      return <UserManagePage />
    case 'territory':
      return <TerritoryPage />
    case 'visit':
      return <FieldVisitPage />
    case 'posm':
      return <PosmAuditPage />
    case 'geofence':
      return <GeofencePage />
    case 'devices':
      return <DeviceMonitorPage />
  }
}
