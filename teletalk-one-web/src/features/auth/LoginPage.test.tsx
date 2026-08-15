import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/renderApp'
import { LoginPage } from './LoginPage'
import i18n from '../../i18n'

async function renderLogin() {
  await i18n.changeLanguage('en')
  const user = userEvent.setup()
  renderWithProviders(<LoginPage />, { route: '/login' })
  await screen.findByLabelText(/POS code/i)
  return user
}

describe('LoginPage', () => {
  it('starts on the identity step', async () => {
    await renderLogin()
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
  })

  it('rejects a POS code that is not eight digits, without calling the API', async () => {
    const user = await renderLogin()
    await user.type(screen.getByLabelText(/POS code/i), '123')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/must be 8 digits/i)
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
  })

  it('normalises Bengali digits typed into the POS field', async () => {
    const user = await renderLogin()
    const input = screen.getByLabelText(/POS code/i) as HTMLInputElement
    await user.type(input, '২০০৬০৭৯৪')
    expect(input.value).toBe('20060794')
  })

  it('surfaces the remedy for an unknown POS code', async () => {
    const user = await renderLogin()
    await user.type(screen.getByLabelText(/POS code/i), '99999999')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't find this POS code/i)
  })

  it('explains that an inactive POS must contact the zonal in-charge', async () => {
    const user = await renderLogin()
    await user.type(screen.getByLabelText(/POS code/i), '20060795')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/zonal in-charge/i)
  })

  it('advances to the password step for a valid POS code', async () => {
    const user = await renderLogin()
    await user.type(screen.getByLabelText(/POS code/i), '20060794')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(screen.getByText('Step 2 of 3')).toBeInTheDocument())
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument()
  })

  it('reports remaining attempts after a wrong password', async () => {
    const user = await renderLogin()
    await user.type(screen.getByLabelText(/POS code/i), '20060794')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByLabelText(/^Password$/i)

    await user.type(screen.getByLabelText(/^Password$/i), 'wrong-one')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/4 attempts left/i)
  })

  it('reaches the OTP step and masks the destination number', async () => {
    const user = await renderLogin()
    await user.type(screen.getByLabelText(/POS code/i), '20060794')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByLabelText(/^Password$/i)

    await user.type(screen.getByLabelText(/^Password$/i), 'Tele@1234')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await screen.findByLabelText(/OTP code/i)
    expect(screen.getByText('8801714****87')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('lets the user step back from password to identity', async () => {
    const user = await renderLogin()
    await user.type(screen.getByLabelText(/POS code/i), '20060794')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByLabelText(/^Password$/i)

    await user.click(screen.getByRole('button', { name: /^back$/i }))
    expect(await screen.findByText('Step 1 of 3')).toBeInTheDocument()
  })
})
