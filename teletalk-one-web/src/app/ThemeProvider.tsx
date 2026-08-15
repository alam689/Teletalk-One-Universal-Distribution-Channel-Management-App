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

export type Theme = 'system' | 'light' | 'dark'

interface ThemeValue {
  theme: Theme
  setTheme: (t: Theme) => void
  cycle: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

function read(): Theme {
  const v = readLocal(StorageKeys.theme)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(read)

  useEffect(() => {
    const root = document.documentElement

    // Components animate background-color for hover, and those same properties
    // are theme-driven — without this a control can be left holding the
    // previous theme's colour. Suppress transitions for the swap frame only.
    root.setAttribute('data-theme-switching', '')

    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)

    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.removeAttribute('data-theme-switching')),
    )
    writeLocal(StorageKeys.theme, theme)
    return () => cancelAnimationFrame(raf)
  }, [theme])

  const cycle = useCallback(
    () => setTheme((cur) => (cur === 'dark' ? 'light' : cur === 'light' ? 'system' : 'dark')),
    [],
  )

  const value = useMemo(() => ({ theme, setTheme, cycle }), [theme, cycle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
