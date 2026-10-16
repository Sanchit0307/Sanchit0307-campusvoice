import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getInitialTheme,
  applyThemeToDocument,
  THEME_STORAGE_KEY,
} from '../../src/utils/themeUtils'

describe('Theme Manager Unit Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.restoreAllMocks()
  })

  describe('getInitialTheme', () => {
    it('returns stored theme when "dark" is in localStorage', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      expect(getInitialTheme()).toBe('dark')
    })

    it('returns stored theme when "light" is in localStorage', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
      expect(getInitialTheme()).toBe('light')
    })

    it('falls back to dark when OS prefers-color-scheme is dark and no stored preference exists', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      expect(getInitialTheme()).toBe('dark')
    })

    it('falls back to light when OS prefers-color-scheme is light and no stored preference exists', () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      expect(getInitialTheme()).toBe('light')
    })

    it('handles localStorage read errors safely without throwing and falls back to light', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: Access is denied for this document')
      })

      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
      }))

      expect(() => getInitialTheme()).not.toThrow()
      expect(getInitialTheme()).toBe('light')
    })

    it('ignores invalid stored theme values and falls back gracefully', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'neon-blue')
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
      }))

      expect(getInitialTheme()).toBe('light')
    })
  })

  describe('applyThemeToDocument', () => {
    it('sets data-theme="dark" on documentElement when theme is dark', () => {
      applyThemeToDocument('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('removes data-theme attribute on documentElement when theme is light', () => {
      document.documentElement.setAttribute('data-theme', 'dark')
      applyThemeToDocument('light')
      expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    })
  })
})
