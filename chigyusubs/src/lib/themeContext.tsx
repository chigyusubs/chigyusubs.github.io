/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Theme } from './theme'
import { ThemeName, defaultThemes, getPreferredTheme } from './themeConstants'

type ThemeContextValue = {
  theme: Theme
  name: ThemeName
  setTheme: (next: ThemeName) => void
  toggleTheme: () => void
}

type ProviderProps = {
  children: React.ReactNode
  value?: Theme
  initialName?: ThemeName
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultThemes.light,
  name: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function ThemeProvider({ children, value, initialName }: ProviderProps) {
  const [name, setName] = useState<ThemeName>(() => getPreferredTheme(initialName))

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', name)
    }
  }, [name])

  const themeValue = useMemo(
    () => ({
      theme: value ?? defaultThemes[name],
      name,
      setTheme: setName,
      toggleTheme: () => setName((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [name, value],
  )

  return <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext).theme
}

export function useThemeControl() {
  return useContext(ThemeContext)
}
