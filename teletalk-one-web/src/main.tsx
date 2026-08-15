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
import './i18n'
import { ErrorBoundary } from './app/ErrorBoundary'
import { ThemeProvider } from './app/ThemeProvider'
import { router } from './app/router'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
