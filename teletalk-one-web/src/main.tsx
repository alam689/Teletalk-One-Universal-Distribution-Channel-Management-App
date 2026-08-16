import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

// Bundled, not CDN — Bengali rendering on low-end Android and older Windows is
// inconsistent when left to the device font.
import '@fontsource/noto-sans-bengali/400.css'
import '@fontsource/noto-sans-bengali/500.css'
import '@fontsource/noto-sans-bengali/600.css'
import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'

import './styles/tokens.css'
import './styles/global.css'
import './app/app-chrome.css'
import { applyLang, readStoredLang } from './i18n'
import { ErrorBoundary } from './app/ErrorBoundary'
import { ThemeProvider } from './app/ThemeProvider'
import { router } from './app/router'
import { installMockTransport } from './mocks/transport'
import { logger } from './lib/logger'

// Before anything can flush a queue restored from a previous tab. No-op the
// moment VITE_API_BASE_URL is set.
installMockTransport()

/**
 * Anything that escapes a component boundary. `ErrorBoundary` catches render
 * crashes; these two catch the ones that happen in a promise nobody awaited,
 * which on this app means a queue flush or a background refresh.
 */
window.addEventListener('unhandledrejection', (event) => {
  logger.error('unhandled rejection', event.reason)
})
window.addEventListener('error', (event) => {
  logger.error('uncaught error', event.error ?? event.message)
})

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

/**
 * The stored language is applied before the first paint. Bangla is bundled so
 * this resolves immediately; English costs one small chunk, which is better
 * than painting the wrong language and swapping it.
 */
void applyLang(readStoredLang()).finally(() => {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
})
