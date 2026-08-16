import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { I18nextProvider } from 'react-i18next'
import { i18n, initI18n } from './src/i18n'
import { hydrateStorage } from './src/lib/storage'
import { outbox } from './src/lib/outbox'
import { installMockTransport } from './src/mocks/transport'
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider'
import { AuthProvider } from './src/features/auth/AuthProvider'
import { RootNavigator } from './src/shell/navigation'
import { light } from './src/theme/tokens'

/**
 * Boot, in the one order that works.
 *
 *   1. **Storage hydrates.** Everything downstream reads it synchronously —
 *      the language, the theme, the session marker and the outbox — so this
 *      has to finish before anything renders. It is the whole reason the app
 *      has a splash state at all.
 *   2. **i18n starts**, reading the stored language.
 *   3. **The mock transport installs**, before the queue can flush, so a
 *      transaction queued in a previous session is not sent to a real URL that
 *      does not exist.
 *   4. **The outbox starts**, loading what the last session left behind and
 *      subscribing to connectivity.
 *
 * Getting this wrong does not crash; it silently loses a queued transaction on
 * a cold start, which is far worse.
 */
export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stopOutbox: (() => void) | undefined

    void (async () => {
      await hydrateStorage()
      await initI18n()
      installMockTransport()
      stopOutbox = outbox.start()
      setReady(true)
    })()

    return () => stopOutbox?.()
  }, [])

  if (!ready) {
    // The splash is painted in the light palette because the stored theme has
    // not been read yet. It is on screen for a few hundred milliseconds; a
    // flash of the wrong ground is better than a flash of nothing.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: light.paper }}>
        <ActivityIndicator color={light.brand} />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  )
}

/** The clock and battery flip with the theme, or they vanish into the header. */
function ThemedStatusBar() {
  const { theme } = useTheme()
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
}
