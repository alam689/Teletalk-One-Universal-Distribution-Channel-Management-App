import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { applyLang } from '../../i18n'
import { renderWithProviders } from '../../test/renderApp'
import { DeviceMonitorPage, TerritoryPage, UserManagePage } from './AdminPages'
import { FieldVisitPage, GeofencePage, PosmAuditPage } from './FieldPages'
import { RetailerManagePage, RetailerOnboardPage, RetailerProvisionPage } from './RetailerPages'
import { ASSIGNABLE_ROLES } from '../auth/roles'

/** Channel management, through the real screens. */

const ADMIN = '30100001'
const FIELD_OFFICER = '30030001'
const RETAILER = '20060794'

async function renderAs(posCode: string, ui: ReactElement) {
  await applyLang('en')
  sessionStorage.setItem('teletalk.mock.pos', posCode)
  renderWithProviders(ui)
}

describe('retailers', () => {
  it('separates outlets that are enlisted from outlets that can actually trade', async () => {
    await renderAs(ADMIN, <RetailerManagePage />)
    expect(await screen.findByText('Talukder Telecom')).toBeInTheDocument()
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0)
  })

  it('says on the onboarding screen that enlisting is not enough to trade', async () => {
    await renderAs(ADMIN, <RetailerOnboardPage />)
    expect(
      await screen.findByText(/BVS id and DMS access still have to be granted/i),
    ).toBeInTheDocument()
  })

  it('holds a retailer record to the same name rules as an e-SAF', async () => {
    await renderAs(ADMIN, <RetailerOnboardPage />)
    // A Bangla field filled with Latin fails at BVS whether the person is
    // buying a SIM or selling one.
    await userEvent.type(await screen.findByLabelText('Outlet name (Bangla)'), 'Talukder')
    await userEvent.click(screen.getByRole('button', { name: 'Enlist' }))
    expect(await screen.findByText(/Bangla keyboard/i)).toBeInTheDocument()
  }, 20_000)

  it('refuses BVS access without an operator id', async () => {
    await renderAs(ADMIN, <RetailerProvisionPage />)
    const boxes = await screen.findAllByLabelText('BVS access')
    // The last card is the unprovisioned outlet.
    await userEvent.click(boxes[boxes.length - 1])
    const saves = screen.getAllByRole('button', { name: 'Save' })
    await userEvent.click(saves[saves.length - 1])

    expect(await screen.findByText(/needs an operator id/i)).toBeInTheDocument()
  }, 20_000)

  it('reports device binding rather than offering it', async () => {
    // Binding happens on the device at first sign-in; a desk cannot grant it.
    await renderAs(ADMIN, <RetailerProvisionPage />)
    expect(
      (await screen.findAllByText(/happens on the device at first sign-in/i)).length,
    ).toBeGreaterThan(0)
  })
})

describe('users', () => {
  it('never offers the administrator role from the admin screen', async () => {
    // One compromised session should not be able to mint another admin.
    expect(ASSIGNABLE_ROLES).not.toContain('admin')
  })

  it('says the capability set comes from the role', async () => {
    await renderAs(ADMIN, <UserManagePage />)
    await userEvent.click(await screen.findByRole('button', { name: 'New user' }))
    expect(await screen.findByText(/Permissions come from the role/i)).toBeInTheDocument()
  })
})

describe('territory', () => {
  it('flags a territory nobody is responsible for', async () => {
    await renderAs(ADMIN, <TerritoryPage />)
    expect((await screen.findAllByText('Nobody assigned')).length).toBeGreaterThan(0)
    expect(screen.getByText('Dhaka zone')).toBeInTheDocument()
  })
})

describe('field visits', () => {
  it('says a visit without a location cannot be checked', async () => {
    await renderAs(FIELD_OFFICER, <FieldVisitPage />)
    expect(await screen.findByText(/cannot be checked/i)).toBeInTheDocument()
  })

  it('shows how far from the outlet a logged visit was taken', async () => {
    // Distance from the registered point is what makes a logged visit
    // checkable rather than assertable.
    await renderAs(FIELD_OFFICER, <FieldVisitPage />)
    expect(await screen.findByText(/108 m away/)).toBeInTheDocument()
  })

  it('is honest that there is no map', async () => {
    await renderAs(FIELD_OFFICER, <FieldVisitPage />)
    expect((await screen.findAllByText(/no map here/i)).length).toBeGreaterThan(0)
  })
})

describe('POSM', () => {
  it('says the photo is recorded by name, not uploaded', async () => {
    await renderAs(FIELD_OFFICER, <PosmAuditPage />)
    expect(await screen.findByText(/upload is not built yet/i)).toBeInTheDocument()
  })

  it('lists what was missing on a past audit', async () => {
    await renderAs(FIELD_OFFICER, <PosmAuditPage />)
    expect(await screen.findByText('4 missing')).toBeInTheDocument()
  })
})

describe('geo-fence', () => {
  it('will not save without a location', async () => {
    await renderAs(ADMIN, <GeofencePage />)
    await userEvent.type(await screen.findByLabelText('Outlet POS code'), '20060794')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/Capture the location first/i)).toBeInTheDocument()
  }, 20_000)

  it('lists the fences that exist, as coordinates and a radius', async () => {
    await renderAs(ADMIN, <GeofencePage />)
    await waitFor(() => expect(screen.getByText('23.806900, 90.368700')).toBeInTheDocument())
    expect(screen.getAllByText(/150 m|200 m|300 m/).length).toBeGreaterThan(0)
  })
})

describe('devices', () => {
  it('separates a device that is quiet from one that is gone', async () => {
    await renderAs(ADMIN, <DeviceMonitorPage />)
    expect(await screen.findByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows the app version, because an outlet three releases back is a problem', async () => {
    await renderAs(ADMIN, <DeviceMonitorPage />)
    expect(await screen.findByText('1.2.8')).toBeInTheDocument()
  })
})

describe('access', () => {
  it('refuses every channel screen to a retailer', async () => {
    await renderAs(RETAILER, <DeviceMonitorPage />)
    expect(await screen.findByText(/doesn't have permission/i)).toBeInTheDocument()
  })
})
