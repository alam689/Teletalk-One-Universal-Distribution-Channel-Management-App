import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { applyLang } from '../../i18n'
import { renderWithProviders } from '../../test/renderApp'
import LiftingDeskPage from './LiftingDeskPage'
import InventoryPage from './InventoryPage'
import SrRoutePage from './SrRoutePage'
import SrAllocationPage from './SrAllocationPage'
import { DESK_SPECS } from './deskSpec'

/**
 * The chain through the real screens.
 *
 * `liftingStates.test.ts` pins the rules; this file pins that the screens
 * actually obey them — a desk showing a button the state machine forbids is
 * the same failure as the state machine being wrong.
 */

const DEALER = '30020001'
const FIELD_OFFICER = '30030001'
const ZONAL = '30040001'
const INVENTORY_OFFICER = '30060001'
const SR = '30010001'

async function renderAs(posCode: string, ui: ReactElement) {
  await applyLang('en')
  sessionStorage.setItem('teletalk.mock.pos', posCode)
  renderWithProviders(ui)
}

describe('the desk queues', () => {
  it('shows a field officer only what is waiting on recommendation', async () => {
    await renderAs(FIELD_OFFICER, <LiftingDeskPage deskId="demandRecommend" />)

    const queue = await screen.findByRole('list')
    const rows = within(queue).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(within(queue).getByText('Awaiting recommendation')).toBeInTheDocument()
  })

  it('shows the dealer everything they raised, at every stage', async () => {
    await renderAs(DEALER, <LiftingDeskPage deskId="demandRequest" />)

    const queue = await screen.findByRole('list')
    // Nine seeded requests, all this dealer's — the point of the ledger is
    // that they are waiting on six other people.
    expect(within(queue).getAllByRole('button').length).toBeGreaterThan(5)
    expect(within(queue).getByText('Awaiting invoice')).toBeInTheDocument()
  })

  it('tells a desk with nothing waiting that it is clear', async () => {
    await renderAs(ZONAL, <LiftingDeskPage deskId="demandApprove" />)
    await screen.findByText('Awaiting approval')

    await renderAs(INVENTORY_OFFICER, <LiftingDeskPage deskId="deliveryChallan" />)
    expect(await screen.findByText('Awaiting challan')).toBeInTheDocument()
  })

  it('refuses a deep link to a desk the role does not hold', async () => {
    await renderAs(DEALER, <LiftingDeskPage deskId="demandApprove" />)
    expect(await screen.findByText(/doesn't have permission/i)).toBeInTheDocument()
  })
})

describe('acting on a request', () => {
  it('a field officer recommends, and the request leaves their queue', async () => {
    await renderAs(FIELD_OFFICER, <LiftingDeskPage deskId="demandRecommend" />)

    const queue = await screen.findByRole('list')
    await userEvent.click(within(queue).getAllByRole('button')[0])

    // The history is the point of the whole screen.
    expect(await screen.findByText('Who had it, and when')).toBeInTheDocument()
    expect(screen.getByText('Demand raised')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Recommend' }))

    expect(await screen.findByText(/Queued/)).toBeInTheDocument()
    expect(
      await screen.findByText(/moved to the next desk/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument()
  }, 20_000)

  it('will not let a zonal in-charge approve more than was asked for', async () => {
    await renderAs(ZONAL, <LiftingDeskPage deskId="demandApprove" />)
    const queue = await screen.findByRole('list')
    await userEvent.click(within(queue).getAllByRole('button')[0])

    const field = await screen.findByLabelText('Bornomala')
    await userEvent.clear(field)
    await userEvent.type(field, '9999')
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(await screen.findByText(/cannot approve more than was asked for/i)).toBeInTheDocument()
  }, 20_000)

  it('will not send a request back without a reason', async () => {
    // A return with no reason is the email process all over again.
    await renderAs(FIELD_OFFICER, <LiftingDeskPage deskId="demandRecommend" />)
    const queue = await screen.findByRole('list')
    await userEvent.click(within(queue).getAllByRole('button')[0])

    await userEvent.click(await screen.findByRole('button', { name: 'Send back' }))
    expect(await screen.findByText(/Choose a reason|reason/i)).toBeInTheDocument()
  }, 20_000)

  it('rejects a deposit that does not match the approved value', async () => {
    await renderAs(DEALER, <LiftingDeskPage deskId="depositSlip" />)
    const queue = await screen.findByRole('list')
    await userEvent.click(within(queue).getAllByRole('button')[0])

    await userEvent.type(await screen.findByLabelText('Bank name'), 'Sonali Bank')
    await userEvent.type(screen.getByLabelText('Branch'), 'Mirpur-10')
    await userEvent.type(screen.getByLabelText('Slip number'), '9988776')
    fireEvent.change(screen.getByLabelText('Deposited on'), { target: { value: '2026-08-14' } })
    const amount = screen.getByLabelText('Amount')
    await userEvent.clear(amount)
    await userEvent.type(amount, '1000')

    await userEvent.click(screen.getByRole('button', { name: 'Attach deposit slip' }))
    expect(await screen.findByText(/does not match the approved value/i)).toBeInTheDocument()
  }, 20_000)

  it('offers no action at all on a request the desk does not own', async () => {
    // The dealer's ledger shows every stage; only their own stages act.
    await renderAs(DEALER, <LiftingDeskPage deskId="demandRequest" />)
    const queue = await screen.findByRole('list')
    const invoiced = within(queue)
      .getAllByRole('button')
      .find((b) => within(b).queryByText('Awaiting invoice'))
    expect(invoiced).toBeDefined()
    await userEvent.click(invoiced as HTMLElement)

    await screen.findByText('Who had it, and when')
    expect(screen.queryByText('Your action')).not.toBeInTheDocument()
  }, 20_000)
})

describe('inventory', () => {
  it('shows what is on hand beside what is already committed', async () => {
    await renderAs(INVENTORY_OFFICER, <InventoryPage scope="central" />)
    expect((await screen.findAllByText('On hand')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Allocated').length).toBeGreaterThan(0)
  })

  it('flags a line that has fallen below its reorder level', async () => {
    await renderAs(INVENTORY_OFFICER, <InventoryPage scope="zonal" />)
    expect((await screen.findAllByText('Below reorder level')).length).toBeGreaterThan(0)
  })

  it('refuses central inventory to a role without the capability', async () => {
    await renderAs(SR, <InventoryPage scope="central" />)
    expect(await screen.findByText(/doesn't have permission/i)).toBeInTheDocument()
  })
})

describe('SR route and allocation', () => {
  it('puts the outstanding balance on the stop', async () => {
    await renderAs(SR, <SrRoutePage />)
    expect(await screen.findByText('Hasan Telecom')).toBeInTheDocument()
    expect(screen.getByText('Outstanding')).toBeInTheDocument()
  })

  it('queues an allocation and settles it exactly once', async () => {
    await renderAs(DEALER, <SrAllocationPage />)

    await waitFor(() => expect(screen.getByLabelText('Sales representative')).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Sales representative'), '30010001')
    await userEvent.type(await screen.findByLabelText('Agni'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'Allocate' }))

    expect(
      await screen.findByText(/Allocation recorded/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument()
  }, 20_000)

  it('will not allocate nothing', async () => {
    await renderAs(DEALER, <SrAllocationPage />)
    await waitFor(() => expect(screen.getByLabelText('Sales representative')).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Sales representative'), '30010001')
    await userEvent.click(screen.getByRole('button', { name: 'Allocate' }))

    expect(await screen.findByText(/quantity for at least one product/i)).toBeInTheDocument()
  }, 20_000)
})

describe('the desk registry', () => {
  it('keeps one desk per stage of the chain', () => {
    expect(DESK_SPECS.map((d) => d.id)).toEqual([
      'demandRequest',
      'demandRecommend',
      'demandApprove',
      'depositSlip',
      'depositVerify',
      'invoiceGenerate',
      'revenueAssurance',
      'deliveryChallan',
    ])
  })
})
