import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Text as RNText } from 'react-native'
import { I18nextProvider } from 'react-i18next'
import { i18n, initI18n } from '../../i18n'
import { hydrateStorage } from '../../lib/storage'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { AuthProvider, useAuth } from './AuthProvider'
import { LoginScreen } from './LoginScreen'
import { __resetMock } from './authMock'
import { prefs, PrefKeys } from '../../lib/storage'

/**
 * Sign-in, driven the way a retailer drives it.
 *
 * This is the one component test that earns its cost: it is the only screen
 * every user meets, it is three steps deep, and each step has a failure the
 * retailer has to act on. If the component layer works at all, it works here.
 */

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
}))

beforeAll(async () => {
  await hydrateStorage()
  await initI18n()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  __resetMock()
  // The POS code is remembered between sign-ins, which is a feature — and a
  // test that inherits it from the previous case is testing the wrong screen.
  prefs.remove(PrefKeys.lastPos)
})

/**
 * `render` is asynchronous in Testing Library 14 — React 19 renders
 * concurrently, so the tree is not on screen when the call returns. Every test
 * awaits it, and then reads through the `screen` singleton.
 */
/**
 * The real navigator swaps the login screen out on success. Rendering it alone
 * keeps the test to one screen, so the session state is surfaced instead — it
 * is the thing being asserted anyway.
 */
function AuthStatus() {
  const { status } = useAuth()
  return <RNText testID="status">{status}</RNText>
}

function renderLogin() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          <LoginScreen />
          <AuthStatus />
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>,
  )
}

it('walks POS code, password and OTP', async () => {
  await renderLogin()

  await fireEvent.changeText(screen.getByLabelText('POS code'), '20060794')
  await fireEvent.press(screen.getByLabelText('Continue'))

  await waitFor(() => expect(screen.getByLabelText('Password')).toBeTruthy())
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Tele@1234')
  await fireEvent.press(screen.getByLabelText('Continue'))

  // The masked MSISDN proves the identity lookup's answer reached the screen,
  // and proves it is masked — the retailer never needs the whole number.
  await waitFor(() => expect(screen.getByText('8801714****87')).toBeTruthy())
  await fireEvent.changeText(screen.getByLabelText('OTP code'), '123456')
  await fireEvent.press(screen.getByLabelText('Sign in'))

  // The session is the assertion. Everything before it was navigation.
  await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('authenticated'))
  // 15s, because the three steps chain ~2.5s of deliberate mock latency and
  // Jest's own 5s ceiling is what times out first, not the assertions.
}, 15_000)

it('names the remedy when the POS code is unknown', async () => {
  await renderLogin()

  await fireEvent.changeText(screen.getByLabelText('POS code'), '99999999')
  await fireEvent.press(screen.getByLabelText('Continue'))

  await waitFor(() =>
    // The server's own code, translated — not "something went wrong".
    expect(screen.getByText(i18n.t('error.posUnknown'))).toBeTruthy(),
  )
})

it('refuses to continue until the POS code is complete', async () => {
  await renderLogin()

  // Re-queried every time: the node captured before a state change is a stale
  // snapshot under React 19's concurrent renderer.
  const disabled = () => screen.getByLabelText('Continue').props.accessibilityState.disabled
  expect(disabled()).toBe(true)

  await fireEvent.changeText(screen.getByLabelText('POS code'), '2006079')
  expect(disabled()).toBe(true)

  await fireEvent.changeText(screen.getByLabelText('POS code'), '20060794')
  expect(disabled()).toBe(false)
})
