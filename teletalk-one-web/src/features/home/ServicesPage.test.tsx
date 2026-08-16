import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderApp'
import ServicesPage from './ServicesPage'
import i18n, { applyLang } from '../../i18n'
import { CAPABILITIES_BY_ROLE } from '../auth/roles'
import { ALL_ITEMS } from './menu'
import type { Role } from '../auth/authTypes'

/** Seeds the mock's session marker so AuthProvider restores that role. */
async function renderAs(posCode: string) {
  await applyLang('en')
  sessionStorage.setItem('teletalk.mock.pos', posCode)
  renderWithProviders(<ServicesPage />, { route: '/services' })
  await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(1))
}

/** Labels the role may see, and labels it must not. */
function expectedLabels(role: Role) {
  const allowed = new Set(CAPABILITIES_BY_ROLE[role])
  const shown = ALL_ITEMS.filter((i) => allowed.has(i.capability)).map((i) => i.id)
  const hidden = ALL_ITEMS.filter((i) => !allowed.has(i.capability)).map((i) => i.id)
  return { shown, hidden }
}

describe('ServicesPage — unauthorized services are absent, not disabled', () => {
  it('renders exactly the retailer’s permitted services and nothing else', async () => {
    await renderAs('20060794')
    const { shown, hidden } = expectedLabels('retailer')

    for (const id of shown) {
      expect(screen.getByText(i18n.t(`item.${id}`)), id).toBeInTheDocument()
    }
    for (const id of hidden) {
      expect(screen.queryByText(i18n.t(`item.${id}`)), id).not.toBeInTheDocument()
    }
  })

  it('hides the entire lifting chain from a retailer', async () => {
    await renderAs('20060794')
    for (const label of ['ERP invoice', 'Revenue assurance', 'Delivery challan', 'Approve demand']) {
      expect(screen.queryByText(label), label).not.toBeInTheDocument()
    }
  })

  it('drops a whole group when the role can use none of it', async () => {
    await renderAs('30070001') // F&A revenue assurance
    expect(screen.queryByText('SIM & customer')).not.toBeInTheDocument()
    expect(screen.queryByText('Recharge & sales')).not.toBeInTheDocument()
    expect(screen.getByText('Lifting & distribution')).toBeInTheDocument()
  })

  it('never renders a disabled service tile', async () => {
    await renderAs('30070001')
    const disabled = screen
      .getAllByRole('button')
      .filter((b) => (b as HTMLButtonElement).disabled)
    expect(disabled).toHaveLength(0)
  })

  it('shows every service to an administrator', async () => {
    await renderAs('30100001')
    for (const item of ALL_ITEMS) {
      expect(screen.getByText(i18n.t(`item.${item.id}`)), item.id).toBeInTheDocument()
    }
  })
})
