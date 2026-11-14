import { useState, useEffect, useCallback, useMemo } from 'react'
import { ThemeContext } from './ThemeContext'
import {
  THEME_STORAGE_KEY,
  getInitialTheme,
  applyThemeToDocument,
} from '../utils/themeUtils'

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)

  // Synchronize theme to document root element
  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  // Listen to OS system color scheme changes when user hasn't set an explicit preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    let hasExplicitPreference = false
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
      hasExplicitPreference = stored === 'dark' || stored === 'light'
    } catch {
      hasExplicitPreference = false
    }

    if (hasExplicitPreference) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      const newSystemTheme = e.matches ? 'dark' : 'light'
      setThemeState(newSystemTheme)
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [])

  const setTheme = useCallback((themeOrUpdater) => {
    setThemeState((prevTheme) => {
      const resolved =
        typeof themeOrUpdater === 'function' ? themeOrUpdater(prevTheme) : themeOrUpdater
      const validTheme = resolved === 'dark' ? 'dark' : 'light'
      applyThemeToDocument(validTheme)
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, validTheme)
      } catch (err) {
        console.warn('Unable to persist theme to localStorage:', err)
      }
      return validTheme
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [setTheme])

  const isDark = theme === 'dark'

  const value = useMemo(
    () => ({
      theme,
      isDark,
      toggleTheme,
      setTheme,
    }),
    [theme, isDark, toggleTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export default ThemeProvider
