export const THEME_STORAGE_KEY = 'campusvoice_theme'

/**
 * Safely reads the initial theme from localStorage or system preference.
 * @returns {'light' | 'dark'}
 */
export function getInitialTheme() {
  if (typeof window === 'undefined') {
    return 'light'
  }

  // 1. Check explicit user preference in localStorage
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') {
      return stored
    }
  } catch (err) {
    console.warn('Unable to access localStorage for theme preference:', err)
  }

  // 2. Check system OS preference
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  } catch (err) {
    console.warn('Unable to query matchMedia for system theme preference:', err)
  }

  // 3. Default fallback
  return 'light'
}

/**
 * Applies the given theme to the document root element.
 * @param {'light' | 'dark'} theme
 */
export function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return

  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}
