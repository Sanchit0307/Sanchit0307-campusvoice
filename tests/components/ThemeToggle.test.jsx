import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, THEME_STORAGE_KEY } from '../../src/context'
import { AuthContext } from '../../src/context/AuthContext'
import ThemeToggle from '../../src/components/ThemeToggle'
import Navbar from '../../src/components/Navbar'

describe('ThemeToggle Component Suite', () => {
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

  it('renders theme toggle button with accessible aria-label and title for light mode', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    const toggleBtn = screen.getByRole('button', { name: /switch to dark theme/i })
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('title', 'Switch to dark theme')
    expect(toggleBtn).toHaveAttribute('data-testid', 'theme-toggle-btn')
  })

  it('toggles theme to dark on click and updates aria-label, document attribute, and localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    const toggleBtn = screen.getByRole('button', { name: /switch to dark theme/i })
    fireEvent.click(toggleBtn)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument()
  })

  it('toggles back to light mode on second click', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    const toggleBtn = screen.getByRole('button', { name: /switch to dark theme/i })
    fireEvent.click(toggleBtn)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    const lightToggleBtn = screen.getByRole('button', { name: /switch to light theme/i })
    fireEvent.click(lightToggleBtn)

    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument()
  })

  it('initializes in dark theme when localStorage has pre-existing dark preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument()
  })

  it('continues to function and updates DOM safely when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: The quota has been exceeded.')
    })

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    const toggleBtn = screen.getByRole('button', { name: /switch to dark theme/i })
    expect(() => fireEvent.click(toggleBtn)).not.toThrow()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('renders correctly inside Navbar and responds to clicks', () => {
    const mockAuthValues = {
      user: null,
      loading: false,
      isConfigured: true,
      isModerator: false,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn(),
    }

    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthValues}>
          <ThemeProvider>
            <Navbar />
          </ThemeProvider>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    const toggleBtn = screen.getByTestId('theme-toggle-btn')
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('aria-label', 'Switch to dark theme')

    fireEvent.click(toggleBtn)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(toggleBtn).toHaveAttribute('aria-label', 'Switch to light theme')
  })
})
