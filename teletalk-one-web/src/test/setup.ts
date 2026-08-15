import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { __resetMock } from '../features/auth/authMock'

afterEach(() => {
  cleanup()
  __resetMock()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
