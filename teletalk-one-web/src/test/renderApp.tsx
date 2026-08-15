import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthProvider'
import { ThemeProvider } from '../app/ThemeProvider'
import '../i18n'

/** Wraps a component in the providers every screen assumes are present. */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  return render(
    <ThemeProvider>
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}
