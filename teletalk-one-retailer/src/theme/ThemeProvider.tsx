import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  categories,
  dark,
  font,
  leading,
  light,
  radius,
  space,
  TAP_MIN,
  type CategoryColour,
  type CategoryName,
  type Palette,
} from './tokens'
import { prefs, PrefKeys } from '../lib/storage'

/**
 * Two themes, and light is the default.
 *
 * The portal had a third, `system`, following the OS. It came out with the
 * switch to a symbol-only control: one icon can say "you are in light, tap for
 * dark", but it cannot also say "you are following the operating system and
 * that currently means light". A stored `system` from an earlier build reads as
 * light. This app was built after that decision, so it never had the third
 * state — the note is here so nobody adds it back as an improvement.
 */
export type Theme = 'light' | 'dark'

export interface ThemeValue {
  theme: Theme
  colors: Palette
  category: (name: CategoryName) => CategoryColour
  /** Line-height multiplier for the *current* language. Bangla needs more. */
  lh: { body: number; tight: number }
  space: typeof space
  radius: typeof radius
  font: typeof font
  tapMin: number
  toggle: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

function read(): Theme {
  return prefs.get(PrefKeys.theme) === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(read)
  const { i18n } = useTranslation()

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      prefs.set(PrefKeys.theme, next)
      return next
    })
  }, [])

  const value = useMemo<ThemeValue>(() => {
    const colors = theme === 'dark' ? dark : light
    const set = categories[theme]
    return {
      theme,
      colors,
      category: (name) => set[name],
      lh: i18n.language === 'en' ? leading.en : leading.bn,
      space,
      radius,
      font,
      tapMin: TAP_MIN,
      toggle,
    }
  }, [theme, i18n.language, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
