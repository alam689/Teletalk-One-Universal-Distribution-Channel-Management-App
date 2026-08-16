import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { applyLang } from '../../i18n'
import { renderWithProviders } from '../../test/renderApp'
import { outbox } from '../../lib/outbox'
import type { ReactElement } from 'react'
import TransactionsPage from './TransactionsPage'
import StockPage from './StockPage'
import CommissionPage from './CommissionPage'
import CustomerSearchPage from './CustomerSearchPage'
import NotificationsPage from './NotificationsPage'
import CommissionStatementPage from './CommissionStatementPage'
import OutstandingPage from './OutstandingPage'
import TargetPage from './TargetPage'
import CampaignsPage from './CampaignsPage'
import OffersPage from './OffersPage'

/** Seeds the mock's session marker so AuthProvider restores that role. */
async function renderAs(posCode: string, ui: ReactElement) {
  await applyLang('en')
  sessionStorage.setItem('teletalk.mock.pos', posCode)
  renderWithProviders(ui)
}

const RETAILER = '20060794'

describe('transaction ledger', () => {
  it('shows the client’s own unsent queue alongside the server’s history', async () => {
    // The retailer activated a SIM with the tower down. The server has never
    // heard of it — and this screen is where they find that out.
    outbox.enqueue({
      kind: 'activation',
      path: '/transactions',
      body: { kind: 'activation', msisdn: '01599887766' },
      id: 'queued-key-1',
    })

    await renderAs(RETAILER, <TransactionsPage />)

    expect(await screen.findByText('01599887766')).toBeInTheDocument()
    expect(screen.getByText('Queued')).toBeInTheDocument()
    // …and the server's rows are there too, with their CBS references.
    expect(await screen.findByText('ACT20268841')).toBeInTheDocument()
  })

  it('filters down to what is unfinished', async () => {
    await renderAs(RETAILER, <TransactionsPage />)
    await screen.findByText('ACT20268841')

    await userEvent.click(screen.getByRole('button', { name: 'Unfinished' }))

    await waitFor(() => expect(screen.queryByText('ACT20268841')).not.toBeInTheDocument())
    expect(screen.getByText('MNP20268830')).toBeInTheDocument()
  })

  it('reads a failure’s remedy out of the server’s own note', async () => {
    await renderAs(RETAILER, <TransactionsPage />)
    expect(
      await screen.findByText(/fingerprint did not match/i),
    ).toBeInTheDocument()
  })
})

describe('SIM stock', () => {
  it('shows the serial range, which is what a shelf count is checked against', async () => {
    await renderAs(RETAILER, <StockPage type="sim" />)
    expect(await screen.findByText('8988015123456780001')).toBeInTheDocument()
    expect(screen.getByText('8988015123456780062')).toBeInTheDocument()
  })

  it('does not warn while stock is above the outlet’s threshold', async () => {
    await renderAs(RETAILER, <StockPage type="sim" />)
    await screen.findByText('8988015123456780001')
    expect(screen.queryByText(/Raise a requisition now/i)).not.toBeInTheDocument()
  })
})

describe('commission', () => {
  it('separates what has been credited from what is still outstanding', async () => {
    // Showing only a total is what generates the call to the zonal office.
    await renderAs(RETAILER, <CommissionPage />)
    expect(await screen.findByText('Outstanding')).toBeInTheDocument()
    expect(screen.getByText('Credited')).toBeInTheDocument()
  })

  it('re-fetches when the period changes', async () => {
    await renderAs(RETAILER, <CommissionPage />)
    await screen.findByText('Outstanding')

    await userEvent.click(screen.getByRole('button', { name: 'This month' }))

    // The month has a line the day does not.
    expect(await screen.findByText(/Target bonus/)).toBeInTheDocument()
  })
})

describe('customer lookup', () => {
  it('asks nothing of the server until a full number is entered', async () => {
    await renderAs(RETAILER, <CustomerSearchPage />)
    await screen.findByLabelText('Mobile number or NID')
    expect(screen.queryByText('Result')).not.toBeInTheDocument()
  })

  it('masks the NID in the result', async () => {
    await renderAs(RETAILER, <CustomerSearchPage />)
    const input = await screen.findByLabelText('Mobile number or NID')
    await userEvent.type(input, '01512345678')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Most. Rehana Parvin')).toBeInTheDocument()
    expect(screen.getByText('••••••7890')).toBeInTheDocument()
    expect(screen.queryByText('1234567890')).not.toBeInTheDocument()
  })

  it('names the correction on a partial number instead of searching for it', async () => {
    await renderAs(RETAILER, <CustomerSearchPage />)
    const input = await screen.findByLabelText('Mobile number or NID')
    await userEvent.type(input, '0151234')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText(/full mobile number or the full NID/i)).toBeInTheDocument()
  })
})

describe('notifications', () => {
  it('marks everything read, and the count follows', async () => {
    await renderAs(RETAILER, <NotificationsPage />)
    expect(await screen.findByText('SIM stock running low')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument(),
    )
  })
})

describe('product stock', () => {
  it('omits the serial range, because a router carton has none', async () => {
    await renderAs(RETAILER, <StockPage type="product" />)
    expect(await screen.findByText('4G router')).toBeInTheDocument()
    expect(screen.queryByText(/^8988015/)).not.toBeInTheDocument()
  })
})

describe('commission statement', () => {
  it('shows the settlement reference, and says so when there is not one yet', async () => {
    // The reference is what a retailer quotes when they ring to ask where the
    // money went, so an unpaid month must not look like a blank column.
    await renderAs(RETAILER, <CommissionStatementPage />)
    expect(await screen.findByText('STL-2026-0714')).toBeInTheDocument()
    expect(screen.getByText('Not yet credited')).toBeInTheDocument()
  })
})

describe('outstanding', () => {
  it('states lateness in days rather than only in colour', async () => {
    await renderAs(RETAILER, <OutstandingPage />)
    expect(await screen.findByText('3 days late')).toBeInTheDocument()
    expect(screen.getByText('Not yet due')).toBeInTheDocument()
  })
})

describe('target', () => {
  it('gives the figures as well as the bar', async () => {
    await renderAs(RETAILER, <TargetPage />)
    // A bar alone cannot be read down a phone to a field officer.
    expect(await screen.findByText(/132/)).toBeInTheDocument()
    expect(screen.getByText('Days left')).toBeInTheDocument()
  })
})

describe('campaigns', () => {
  it('lists everything visible on the campaign screen', async () => {
    await renderAs(RETAILER, <CampaignsPage />)
    expect(await screen.findByText('New retailer referral')).toBeInTheDocument()
  })

  it('narrows to what the outlet is actually in on "my campaign"', async () => {
    await renderAs(RETAILER, <CampaignsPage ownOnly />)
    expect(await screen.findByText('Eid recharge campaign')).toBeInTheDocument()
    expect(screen.queryByText('New retailer referral')).not.toBeInTheDocument()
  })
})

describe('offers', () => {
  it('keeps the dial code Latin, because the customer types it', async () => {
    await renderAs(RETAILER, <OffersPage />)
    const code = await screen.findByText('*111*49#')
    expect(code).toHaveClass('identifier')
  })
})
