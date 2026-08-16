import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { applyLang } from '../../i18n'
import { renderWithProviders } from '../../test/renderApp'
import RequisitionPage from './RequisitionPage'
import ComplaintPage from './ComplaintPage'
import Customer360Page from './Customer360Page'
import PerformancePage from './PerformancePage'
import { PaymentCollectPage, SettlementPage, SubsidyPage, WalletPage } from './MoneyPages'
import { StockMovementPage, StockReconcilePage } from './StockOpsPages'

/** Outlet operations, through the real screens. */

const RETAILER = '20060794'
const CSIM = '30090001'
const DEALER = '30020001'
const ADMIN = '30100001'

async function renderAs(posCode: string, ui: ReactElement) {
  await applyLang('en')
  sessionStorage.setItem('teletalk.mock.pos', posCode)
  renderWithProviders(ui)
}

describe('requisition', () => {
  it('shows the outlet its own requisitions at every stage', async () => {
    await renderAs(RETAILER, <RequisitionPage mode="raise" />)
    const queue = await screen.findByRole('list')
    expect(within(queue).getByText('Awaiting approval')).toBeInTheDocument()
    expect(within(queue).getByText('Fulfilled')).toBeInTheDocument()
  })

  it('will not approve more than was asked for', async () => {
    await renderAs(CSIM, <RequisitionPage mode="approve" />)
    const queue = await screen.findByRole('list')
    await userEvent.click(within(queue).getAllByRole('button')[0])

    const field = await screen.findByLabelText('Scratch card ৳100')
    await userEvent.clear(field)
    await userEvent.type(field, '9999')
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(await screen.findByText(/cannot approve more than was asked for/i)).toBeInTheDocument()
  }, 20_000)

  it('refuses the approver desk to the outlet that raised it', async () => {
    await renderAs(RETAILER, <RequisitionPage mode="approve" />)
    expect(await screen.findByText(/doesn't have permission/i)).toBeInTheDocument()
  })
})

describe('complaints', () => {
  it('states the SLA before the ticket is raised, not after', async () => {
    await renderAs(RETAILER, <ComplaintPage mode="create" />)
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Recharge not received' })).toBeInTheDocument(),
    )
    await userEvent.selectOptions(screen.getByLabelText('What kind of problem'), 'rechargeMissing')
    expect(await screen.findByText(/within 4 hours/i)).toBeInTheDocument()
  })

  it('shows a blown SLA as breached rather than as arithmetic', async () => {
    await renderAs(RETAILER, <ComplaintPage mode="track" />)
    expect(await screen.findByText(/over$/i)).toBeInTheDocument()
    expect(screen.getByText('Commission not credited')).toBeInTheDocument()
  })
})

describe('money', () => {
  it('carries the sign of a wallet movement on the glyph, not only in colour', async () => {
    await renderAs(RETAILER, <WalletPage />)
    expect((await screen.findAllByText(/^−/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^\+/).length).toBeGreaterThan(0)
  })

  it('will not record a bank collection without a reference', async () => {
    // An unreconcilable collection is an argument three weeks later.
    await renderAs(DEALER, <PaymentCollectPage />)
    await userEvent.type(await screen.findByLabelText('Collected from'), '20060794')
    await userEvent.type(screen.getByLabelText('Amount'), '5000')
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'bank')
    await userEvent.click(screen.getByRole('button', { name: 'Record collection' }))

    expect(await screen.findByText(/transaction reference/i)).toBeInTheDocument()
  }, 20_000)

  it('shows deductions as their own line rather than netting them away', async () => {
    await renderAs(ADMIN, <SettlementPage />)
    expect((await screen.findAllByText('Deductions')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Payable').length).toBeGreaterThan(0)
  })

  it('splits subsidy into paid and pending', async () => {
    await renderAs(ADMIN, <SubsidyPage />)
    expect(await screen.findByText('Total subsidy')).toBeInTheDocument()
    expect(screen.getAllByText('Outstanding').length).toBeGreaterThan(0)
  })
})

describe('stock movements', () => {
  it('asks a return for a reason and a transfer for a destination', async () => {
    await renderAs(RETAILER, <StockMovementPage kind="return" />)
    expect(await screen.findByLabelText('Reason')).toBeInTheDocument()
    expect(screen.queryByLabelText('Send to')).not.toBeInTheDocument()
  })

  it('will not send an empty movement', async () => {
    await renderAs(RETAILER, <StockMovementPage kind="return" />)
    await waitFor(() => expect(screen.getByLabelText('Reason')).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Reason'), 'damaged')
    await userEvent.click(screen.getByRole('button', { name: 'Send return' }))

    expect(await screen.findByText(/quantity for at least one product/i)).toBeInTheDocument()
  }, 20_000)

  it('does not show the system figure while the shelf is being counted', async () => {
    // Otherwise a stock count becomes a transcription exercise and the
    // variance is always zero.
    await renderAs(ADMIN, <StockReconcilePage />)
    expect(await screen.findByLabelText('Agni')).toBeInTheDocument()
    expect(screen.queryByText('62')).not.toBeInTheDocument()
  })
})

describe('customer 360', () => {
  it('keeps the NID masked in the fuller view too', async () => {
    await renderAs(ADMIN, <Customer360Page />)
    await userEvent.type(await screen.findByLabelText('Mobile number'), '01512345678')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('••••••7890')).toBeInTheDocument()
    expect(screen.queryByText('1234567890')).not.toBeInTheDocument()
  }, 20_000)

  it('lists every SIM on the NID — what the 15-SIM ceiling counts', async () => {
    await renderAs(ADMIN, <Customer360Page />)
    await userEvent.type(await screen.findByLabelText('Mobile number'), '01512345678')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('01598877665')).toBeInTheDocument()
  }, 20_000)
})

describe('performance', () => {
  it('gives a trend a word, not only an arrow', async () => {
    await renderAs(ADMIN, <PerformancePage />)
    expect(await screen.findByText(/Falling/)).toBeInTheDocument()
    expect(screen.getAllByText(/Rising/).length).toBeGreaterThan(0)
  })
})
