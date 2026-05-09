import React, { useEffect, useState, createContext, useContext } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType { theme: Theme; setTheme: (t: Theme) => void; isDarkMode: boolean }

export const ThemeProviderContext = createContext<ThemeContextType>({
  theme: 'system', setTheme: () => null, isDarkMode: false,
})

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ui-theme',
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  )
  const [isDarkMode, setIsDarkMode] = useState(false)

  const applyTheme = (t: Theme) => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    const resolved = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t
    root.classList.add(resolved)
    setIsDarkMode(resolved === 'dark')
  }

  useEffect(() => { applyTheme(theme) }, [theme])

  const setTheme = (t: Theme) => {
    localStorage.setItem(storageKey, t)
    setThemeState(t)
  }

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, isDarkMode }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeProviderContext)
