import { configure } from '@testing-library/react-native'
import { setOnlineForTesting } from '../lib/net'

/**
 * Test setup.
 *
 * Two things are faked and nothing else. AsyncStorage and SecureStore both
 * cross the native bridge, which does not exist under Jest; everything above
 * them — the sync cache, the queue, the validators — is the real code, because
 * a test of a mock of the outbox would test nothing.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    getItemAsync: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItemAsync: (key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve()
    },
    deleteItemAsync: (key: string) => {
      store.delete(key)
      return Promise.resolve()
    },
  }
})

// NetInfo's event listener never fires under Jest, so the module's default of
// "online" stands. Set it explicitly anyway: a test that depends on a default
// is a test that breaks when the default changes.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => undefined },
}))

/**
 * The mocks deliberately take their time — `verifyPassword` waits 600ms and
 * `requestOtp` another 400 — so a step that chains both lands right on Testing
 * Library's 1s default. This is the same flake the portal's suite hit, fixed
 * the same way: give the async utilities room rather than making the mock lie
 * about how slow a real handset is.
 */
configure({ asyncUtilTimeout: 5000 })

beforeEach(() => {
  setOnlineForTesting(true)
})
