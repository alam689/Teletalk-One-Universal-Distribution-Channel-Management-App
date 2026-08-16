import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { __resetMock } from '../features/auth/authMock'
import { __resetActivationMock } from '../features/activation/activationMock'
import { __resetLiftingMock } from '../features/lifting/liftingMock'
import { __resetOpsMock } from '../features/ops/opsMock'
import { __resetChannelMock } from '../features/channel/channelMock'
import { installMockTransport } from '../mocks/transport'
import { __resetCounterMock } from '../features/counter/counterMock'
import { notificationStore } from '../features/counter/notificationStore'
import { outbox } from '../lib/outbox'

/**
 * The mocks take 0.5–1.2s on purpose, so that loading and queued states are
 * real rather than theoretical. Testing Library's default 1s async timeout is
 * inside that window, which made the sign-in test fail intermittently once the
 * suite grew to eighteen files running in parallel — green alone, red under
 * load. An intermittently failing suite is worse than a slow one.
 */
configure({ asyncUtilTimeout: 4000 })

installMockTransport()

afterEach(() => {
  cleanup()
  __resetMock()
  __resetActivationMock()
  __resetLiftingMock()
  __resetOpsMock()
  __resetChannelMock()
  __resetCounterMock()
  notificationStore.clear()
  outbox.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
