import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { readLocal, StorageKeys, writeLocal } from '../lib/storage'

/**
 * Two states, and light is the default.
 *
 * There used to be a third, `system`, following `prefers-color-scheme`. It
 * came out with the switch to a symbol-only control: a single icon can say
 * "you are in light, tap for dark", but it cannot also say "you are following
 * the operating system and that currently means light". A stored `system`
 * from an earlier build is read as light.
 */
export type Theme = 'light' | 'dark'

interface ThemeValue {
  theme: Theme
  setTheme: (t: Theme) => void
  cycle: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

function read(): Theme {
  return readLocal(StorageKeys.theme) === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(read)

  useEffect(() => {
    const root = document.documentElement

    // Components animate background-color for hover, and those same properties
    // are theme-driven — without this a control can be left holding the
    // previous theme's colour. Suppress transitions for the swap frame only.
    root.setAttribute('data-theme-switching', '')

    root.setAttribute('data-theme', theme)

    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.removeAttribute('data-theme-switching')),
    )
    writeLocal(StorageKeys.theme, theme)
    return () => cancelAnimationFrame(raf)
  }, [theme])

  const cycle = useCallback(() => setTheme((cur) => (cur === 'dark' ? 'light' : 'dark')), [])

  const value = useMemo(() => ({ theme, setTheme, cycle }), [theme, cycle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
