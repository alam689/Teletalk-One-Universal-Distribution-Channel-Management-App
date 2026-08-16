import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { applyLang } from '../../i18n'
import { renderWithProviders } from '../../test/renderApp'
import { outbox } from '../../lib/outbox'
import SalePage from './SalePage'
import { SALE_SPECS } from './saleSpec'

/**
 * The over-the-counter sales. They matter twice: they are the most frequent
 * transaction at a counter, and they are the one that costs a customer money
 * when it goes wrong twice.
 */

const RETAILER = '20060794'

async function renderSale(saleId: string) {
  await applyLang('en')
  sessionStorage.setItem('teletalk.mock.pos', RETAILER)
  renderWithProviders(<SalePage saleId={saleId} />)
  await screen.findByLabelText('Mobile number')
}

describe('recharge', () => {
  it('queues one mutation and reports it only once the server confirms', async () => {
    await renderSale('recharge')

    await userEvent.type(screen.getByLabelText('Mobile number'), '01512345678')
    await userEvent.click(screen.getByRole('button', { name: '৳ 50.00' }))
    await userEvent.click(screen.getByRole('button', { name: 'Recharge' }))

    // Queued first — never "done" before the server has said so.
    expect(await screen.findByText('Queued')).toBeInTheDocument()
    expect(await screen.findByText('Recharge complete', undefined, { timeout: 5000 })).toBeVisible()
    expect(screen.getByText(/^RCH/)).toBeInTheDocument()
    expect(outbox.list()).toHaveLength(1)
  }, 20_000)

  it('holds the counter to the published range', async () => {
    await renderSale('recharge')

    await userEvent.type(screen.getByLabelText('Mobile number'), '01512345678')
    await userEvent.type(screen.getByLabelText('Amount'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Recharge' }))

    expect(await screen.findByText(/between ৳10 and ৳5,000/)).toBeInTheDocument()
    expect(outbox.list()).toHaveLength(0)
  })

  it('refuses a number that is not a Teletalk number', async () => {
    await renderSale('recharge')

    await userEvent.type(screen.getByLabelText('Mobile number'), '01712345678')
    await userEvent.click(screen.getByRole('button', { name: '৳ 50.00' }))
    await userEvent.click(screen.getByRole('button', { name: 'Recharge' }))

    expect(await screen.findByText(/Teletalk numbers start with 015/)).toBeInTheDocument()
  })
})

describe('powerload', () => {
  it('offers denominations and nothing else', async () => {
    await renderSale('powerload')
    // No free-amount field: a pack that is not on the list does not exist.
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '৳ 1,000.00' })).toBeInTheDocument()
  })

  it('will not send without one chosen', async () => {
    await renderSale('powerload')
    await userEvent.type(screen.getByLabelText('Mobile number'), '01512345678')
    await userEvent.click(screen.getByRole('button', { name: 'Send powerload' }))

    expect(await screen.findByText(/Enter an amount/i)).toBeInTheDocument()
    expect(outbox.list()).toHaveLength(0)
  })
})

describe('product sale', () => {
  it('takes the price from the plan rather than from a typed amount', async () => {
    await renderSale('productSell')
    await waitFor(() => expect(screen.getByLabelText('Plan')).toBeInTheDocument())
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Mobile number'), '01512345678')
    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'APON')
    await userEvent.click(screen.getByRole('button', { name: 'Sell' }))

    expect(await screen.findByText('Sale complete', undefined, { timeout: 5000 })).toBeVisible()
    // Apon is ৳250 in the catalogue; nothing on screen let the retailer change it.
    expect(screen.getByText('৳ 250.00')).toBeInTheDocument()
  }, 20_000)
})

describe('access', () => {
  it('refuses the deep link to a role without the capability', async () => {
    await applyLang('en')
    sessionStorage.setItem('teletalk.mock.pos', '30070001') // F&A revenue assurance
    renderWithProviders(<SalePage saleId="recharge" />)

    expect(await screen.findByText(/doesn't have permission/i)).toBeInTheDocument()
  })
})

describe('the registry', () => {
  it('sells a scratch card off the shelf, with no number', () => {
    const card = SALE_SPECS.find((s) => s.id === 'scratchCard')
    // A scratch card is a piece of card, not value sent to a handset. Asking
    // for a number here is a field the retailer would invent something for.
    expect(card?.requiresMsisdn).toBe(false)
    expect(card?.denominations.length).toBeGreaterThan(0)
  })

  it('keeps one spec per catalogue tile', () => {
    expect(SALE_SPECS.map((s) => s.id)).toEqual([
      'recharge',
      'flexiload',
      'powerload',
      'tbps',
      'productSell',
      'scratchCard',
    ])
  })
})
