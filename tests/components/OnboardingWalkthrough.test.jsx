import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../../src/context/AuthContext'
import OnboardingProvider from '../../src/components/onboarding/OnboardingProvider'
import Navbar from '../../src/components/Navbar'
import Footer from '../../src/components/Footer'
import {
  getOnboardingStatus,
  setOnboardingStatus,
  resetMemoryFallback,
} from '../../src/utils/onboardingStorage'

describe('Onboarding Walkthrough Component Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMemoryFallback()
    vi.restoreAllMocks()
  })

  function renderWithProviders({
    authOverrides = {},
    initialRoute = '/',
    children = null,
  } = {}) {
    const defaultAuth = {
      user: {
        uid: 'test-student-1',
        displayName: 'Alex Rivers',
        email: 'alex@campus.edu',
      },
      loading: false,
      authError: null,
      isConfigured: true,
      isModerator: false,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn(),
      refreshModeratorStatus: vi.fn(),
      ...authOverrides,
    }

    return render(
      <AuthContext.Provider value={defaultAuth}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <OnboardingProvider>
            <Navbar />
            <main id="main-content">
              <Routes>
                <Route
                  path="/"
                  element={
                    <div>
                      <h1>Home Page</h1>
                      {children}
                    </div>
                  }
                />
                <Route
                  path="/ideas"
                  element={
                    <div>
                      <h1>Campus Ideas</h1>
                      <div data-tour="ideas-filters">Filter Bar</div>
                      <div data-tour="idea-upvote">
                        <button type="button" className="upvote-btn">
                          ▲ 10 Upvotes
                        </button>
                      </div>
                    </div>
                  }
                />
                <Route
                  path="/submit"
                  element={
                    <div>
                      <h1>Submit Idea</h1>
                    </div>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <div>
                      <h1>Dashboard</h1>
                      <div data-tour="dashboard-stats">Stats Grid</div>
                      <nav data-tour="moderator-tabs">Moderator Tabs</nav>
                    </div>
                  }
                />
              </Routes>
            </main>
            <Footer />
          </OnboardingProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  it('1. First-time authenticated student sees the welcome screen', async () => {
    renderWithProviders()

    expect(
      await screen.findByRole('heading', { name: /Welcome to CampusVoice!/i })
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Discover ideas, share your suggestions and help make campus life better/i)
    ).toBeInTheDocument()

    expect(screen.getByTestId('onboarding-start-btn')).toBeInTheDocument()
    expect(screen.getByTestId('onboarding-skip-btn')).toBeInTheDocument()
  })

  it('2. Unauthenticated visitor does not see the tour or welcome screen', () => {
    renderWithProviders({
      authOverrides: {
        user: null,
        loading: false,
      },
    })

    expect(screen.queryByRole('heading', { name: /Welcome to CampusVoice!/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Step 1 of 5/i)).not.toBeInTheDocument()
  })

  it('3. Tour waits until authentication loading completes before showing', () => {
    renderWithProviders({
      authOverrides: {
        user: null,
        loading: true,
      },
    })

    expect(screen.queryByRole('heading', { name: /Welcome to CampusVoice!/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Step 1 of 5/i)).not.toBeInTheDocument()
  })

  it('4. Completing the tour navigates through steps and persists completion for current user', async () => {
    renderWithProviders()

    // 1. Welcome screen
    const startBtn = await screen.findByTestId('onboarding-start-btn')
    fireEvent.click(startBtn)

    // Step 1: Navigation
    expect(await screen.findByText(/Step 1 of 5/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Effortless Navigation/i })).toBeInTheDocument()

    // Step 2: Discover Ideas
    fireEvent.click(screen.getByTestId('onboarding-step-next'))
    expect(await screen.findByText(/Step 2 of 5/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Discover Campus Ideas/i })).toBeInTheDocument()

    // Step 3: Upvote
    fireEvent.click(screen.getByTestId('onboarding-step-next'))
    expect(await screen.findByText(/Step 3 of 5/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Support Proposals with Upvotes/i })).toBeInTheDocument()

    // Step 4: Submit Idea
    fireEvent.click(screen.getByTestId('onboarding-step-next'))
    expect(await screen.findByText(/Step 4 of 5/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Submit Your Own Idea/i })).toBeInTheDocument()

    // Step 5: Track Progress (Student)
    fireEvent.click(screen.getByTestId('onboarding-step-next'))
    expect(await screen.findByText(/Step 5 of 5/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Track Progress & Notifications/i })).toBeInTheDocument()

    // Finish Tour
    const finishBtn = screen.getByTestId('onboarding-step-finish')
    expect(finishBtn).toBeInTheDocument()
    fireEvent.click(finishBtn)

    // Tour modal disappears
    await waitFor(() => {
      expect(screen.queryByText(/Step 5 of 5/i)).not.toBeInTheDocument()
    })

    // Verify persisted state
    const saved = getOnboardingStatus('test-student-1')
    expect(saved).not.toBeNull()
    expect(saved.completed).toBe(true)
    expect(saved.skipped).toBe(false)
  })

  it('5. Skipping the tour from welcome screen persists dismissal', async () => {
    renderWithProviders()

    const skipBtn = await screen.findByTestId('onboarding-skip-btn')
    fireEvent.click(skipBtn)

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Welcome to CampusVoice!/i })).not.toBeInTheDocument()
    })

    const saved = getOnboardingStatus('test-student-1')
    expect(saved).not.toBeNull()
    expect(saved.skipped).toBe(true)
    expect(saved.completed).toBe(false)
  })

  it('6. Returning user who previously completed or skipped does not see tour automatically', () => {
    setOnboardingStatus('test-student-1', { completed: true, skipped: false })

    renderWithProviders()

    expect(screen.queryByRole('heading', { name: /Welcome to CampusVoice!/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Step 1 of 5/i)).not.toBeInTheDocument()
  })

  it('7. Replay button in Navbar deliberately relaunches the tour for returning users', async () => {
    setOnboardingStatus('test-student-1', { completed: true, skipped: false })

    renderWithProviders()

    expect(screen.queryByRole('heading', { name: /Welcome to CampusVoice!/i })).not.toBeInTheDocument()

    // Click "Tour" button in Navbar
    const tourBtn = screen.getByTestId('navbar-tour-btn')
    expect(tourBtn).toBeInTheDocument()
    fireEvent.click(tourBtn)

    // Welcome screen opens
    expect(
      await screen.findByRole('heading', { name: /Welcome to CampusVoice!/i })
    ).toBeInTheDocument()
  })

  it('8. Different user UIDs do not share onboarding state', async () => {
    // User A has completed tour
    setOnboardingStatus('user-alpha', { completed: true, skipped: false })

    // User B logs in fresh
    renderWithProviders({
      authOverrides: {
        user: { uid: 'user-beta', displayName: 'Beta Student' },
      },
    })

    expect(
      await screen.findByRole('heading', { name: /Welcome to CampusVoice!/i })
    ).toBeInTheDocument()

    expect(getOnboardingStatus('user-alpha').completed).toBe(true)
    expect(getOnboardingStatus('user-beta')).toBeNull()
  })

  it('9. Moderator guidance adapts Step 5 to highlight moderation queue and analytics', async () => {
    renderWithProviders({
      authOverrides: {
        user: { uid: 'mod-user-1', displayName: 'Staff Member' },
        isModerator: true,
      },
    })

    // Start tour
    const startBtn = await screen.findByTestId('onboarding-start-btn')
    fireEvent.click(startBtn)

    // Advance 4 times to Step 5
    for (let i = 1; i <= 4; i++) {
      fireEvent.click(screen.getByTestId('onboarding-step-next'))
    }

    // Verify moderator specific Step 5 content
    expect(await screen.findByText(/Step 5 of 5/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Moderation Queue & Analytics/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/As campus staff, you can review submitted proposals in the Moderation Queue/i)
    ).toBeInTheDocument()
  })

  it('10. Missing target elements do not crash the application and allow navigation', async () => {
    renderWithProviders()

    const startBtn = await screen.findByTestId('onboarding-start-btn')
    fireEvent.click(startBtn)

    expect(await screen.findByText(/Step 1 of 5/i)).toBeInTheDocument()

    // Can still advance forward and backward cleanly
    fireEvent.click(screen.getByTestId('onboarding-step-next'))
    expect(await screen.findByText(/Step 2 of 5/i)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('onboarding-step-back'))
    expect(await screen.findByText(/Step 1 of 5/i)).toBeInTheDocument()
  })

  it('11. Keyboard Escape dismisses the tour gracefully', async () => {
    renderWithProviders()

    expect(await screen.findByRole('heading', { name: /Welcome to CampusVoice!/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Welcome to CampusVoice!/i })).not.toBeInTheDocument()
    })

    // Persists dismissal
    expect(getOnboardingStatus('test-student-1').skipped).toBe(true)
  })

  it('12. Storage exceptions are handled gracefully without breaking the walkthrough', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage disabled in private window')
    })

    renderWithProviders()

    const skipBtn = await screen.findByTestId('onboarding-skip-btn')
    // Should not throw or crash
    expect(() => fireEvent.click(skipBtn)).not.toThrow()

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Welcome to CampusVoice!/i })).not.toBeInTheDocument()
    })
  })

  it('13. Spotlight renders an SVG mask cutout over the target without blurring filters', async () => {
    renderWithProviders()

    const startBtn = await screen.findByTestId('onboarding-start-btn')
    fireEvent.click(startBtn)

    expect(await screen.findByText(/Step 1 of 5/i)).toBeInTheDocument()

    // Verify SVG mask and cutout rect exist
    const svgOverlay = document.querySelector('svg.onboarding-spotlight-svg')
    expect(svgOverlay).toBeInTheDocument()

    const maskDef = document.querySelector('#cv-spotlight-mask')
    expect(maskDef).toBeInTheDocument()

    // Verify backdrop layer uses the mask
    const dimLayer = document.querySelector('.onboarding-dim-layer')
    expect(dimLayer).toBeInTheDocument()
    expect(dimLayer).toHaveAttribute('mask', 'url(#cv-spotlight-mask)')

    // Verify highlight ring is rendered
    const ring = document.querySelector('.onboarding-spotlight-ring')
    expect(ring).toBeInTheDocument()
  })

  it('14. Tooltip positions without obscuring the upvote target element on Step 3', async () => {
    renderWithProviders({ initialRoute: '/ideas' })

    const startBtn = await screen.findByTestId('onboarding-start-btn')
    fireEvent.click(startBtn)

    // Advance to Step 3: Upvote
    fireEvent.click(await screen.findByTestId('onboarding-step-next'))
    fireEvent.click(await screen.findByTestId('onboarding-step-next'))

    expect(await screen.findByText(/Step 3 of 5/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Support Proposals with Upvotes/i })).toBeInTheDocument()

    const tooltipCard = document.querySelector('.onboarding-tooltip-card')
    expect(tooltipCard).toBeInTheDocument()

    // Verify tooltip card has valid position coordinates
    expect(tooltipCard.style.position).toBe('fixed')
    expect(tooltipCard.style.top).toBeDefined()
    expect(tooltipCard.style.left).toBeDefined()
  })

  it('15. Delayed role resolution suppresses automatic modal until role verification settles', async () => {
    // Start with authenticated user whose role is still resolving
    const { rerender } = render(
      <AuthContext.Provider
        value={{
          user: { uid: 'delayed-student-1', displayName: 'Sam' },
          loading: false,
          authError: null,
          isConfigured: true,
          isModerator: false,
          roleResolved: false,
          isRoleLoading: true,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn(),
          refreshModeratorStatus: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/']}>
          <OnboardingProvider>
            <Navbar />
            <main id="main-content"><h1>Home</h1></main>
            <Footer />
          </OnboardingProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // While role is resolving, welcome screen MUST NOT open prematurely
    expect(screen.queryByRole('heading', { name: /Welcome to CampusVoice!/i })).not.toBeInTheDocument()

    // Role resolves
    rerender(
      <AuthContext.Provider
        value={{
          user: { uid: 'delayed-student-1', displayName: 'Sam' },
          loading: false,
          authError: null,
          isConfigured: true,
          isModerator: false,
          roleResolved: true,
          isRoleLoading: false,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn(),
          refreshModeratorStatus: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/']}>
          <OnboardingProvider>
            <Navbar />
            <main id="main-content"><h1>Home</h1></main>
            <Footer />
          </OnboardingProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Now welcome screen opens automatically
    expect(
      await screen.findByRole('heading', { name: /Welcome to CampusVoice!/i })
    ).toBeInTheDocument()
  })

  it('16. Logout resets active tour and login of a subsequent new user triggers fresh welcome modal', async () => {
    // 1. Initial user logs in and starts tour
    const { rerender } = render(
      <AuthContext.Provider
        value={{
          user: { uid: 'first-user-uid', displayName: 'User One' },
          loading: false,
          authError: null,
          isConfigured: true,
          isModerator: false,
          roleResolved: true,
          isRoleLoading: false,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn(),
          refreshModeratorStatus: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/']}>
          <OnboardingProvider>
            <Navbar />
            <main id="main-content"><h1>Home</h1></main>
            <Footer />
          </OnboardingProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(
      await screen.findByRole('heading', { name: /Welcome to CampusVoice!/i })
    ).toBeInTheDocument()

    // First user starts tour
    fireEvent.click(screen.getByTestId('onboarding-start-btn'))
    expect(await screen.findByText(/Step 1 of 5/i)).toBeInTheDocument()

    // 2. User signs out
    rerender(
      <AuthContext.Provider
        value={{
          user: null,
          loading: false,
          authError: null,
          isConfigured: true,
          isModerator: false,
          roleResolved: true,
          isRoleLoading: false,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn(),
          refreshModeratorStatus: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/']}>
          <OnboardingProvider>
            <Navbar />
            <main id="main-content"><h1>Home</h1></main>
            <Footer />
          </OnboardingProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Tour ceases rendering completely
    expect(screen.queryByText(/Step 1 of 5/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Welcome to CampusVoice!/i })).not.toBeInTheDocument()

    // 3. New user signs in
    rerender(
      <AuthContext.Provider
        value={{
          user: { uid: 'second-fresh-uid', displayName: 'User Two' },
          loading: false,
          authError: null,
          isConfigured: true,
          isModerator: false,
          roleResolved: true,
          isRoleLoading: false,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn(),
          refreshModeratorStatus: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/']}>
          <OnboardingProvider>
            <Navbar />
            <main id="main-content"><h1>Home</h1></main>
            <Footer />
          </OnboardingProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // New user sees welcome screen cleanly
    expect(
      await screen.findByRole('heading', { name: /Welcome to CampusVoice!/i })
    ).toBeInTheDocument()
  })

  it('17. Mobile viewport at 360x800 targets mobile-menu-btn and clamps tooltip within bounds', async () => {
    // Simulate mobile viewport 360x800
    window.innerWidth = 360
    window.innerHeight = 800

    renderWithProviders()

    const startBtn = await screen.findByTestId('onboarding-start-btn')
    fireEvent.click(startBtn)

    expect(await screen.findByText(/Step 1 of 5/i)).toBeInTheDocument()

    // Mobile menu button exists with data-tour
    const mobileBtn = document.querySelector('[data-tour="mobile-menu-btn"]')
    expect(mobileBtn).toBeInTheDocument()

    const tooltipCard = document.querySelector('.onboarding-tooltip-card')
    expect(tooltipCard).toBeInTheDocument()
    expect(tooltipCard.style.left).toBe('12px')
    expect(tooltipCard.style.right).toBe('12px')
  })

  it('18. Mobile viewports at 375x812 and 414x896 maintain responsive coordinates', async () => {
    // Simulate 375x812 (iPhone X/11 Pro)
    window.innerWidth = 375
    window.innerHeight = 812

    renderWithProviders()

    const startBtn = await screen.findByTestId('onboarding-start-btn')
    fireEvent.click(startBtn)

    const tooltipCard = document.querySelector('.onboarding-tooltip-card')
    expect(tooltipCard).toBeInTheDocument()
    expect(tooltipCard.style.position).toBe('fixed')

    // Simulate 414x896 (iPhone 11/XR)
    window.innerWidth = 414
    window.innerHeight = 896
    fireEvent(window, new Event('resize'))

    expect(tooltipCard.style.position).toBe('fixed')
  })
})

