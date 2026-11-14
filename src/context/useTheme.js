import { useContext } from 'react'
import { ThemeContext } from './ThemeContext'

/**
 * Custom React hook to access the current theme and toggle functions.
 * Returns default values gracefully if used outside a ThemeProvider.
 * @returns {{
 *   theme: 'light' | 'dark',
 *   isDark: boolean,
 *   toggleTheme: () => void,
 *   setTheme: (theme: 'light' | 'dark') => void
 * }}
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: 'light',
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
    }
  }
  return context
}

export default useTheme
