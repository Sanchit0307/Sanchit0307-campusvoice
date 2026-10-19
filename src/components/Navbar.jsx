import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth, useOnboarding } from '../context'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import './Navbar.css'

function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAuthPending, setIsAuthPending] = useState(false)
  const [authFeedbackError, setAuthFeedbackError] = useState(null)

  const { user, loading, isConfigured, signInWithGoogle, signOutUser, isModerator } =
    useAuth()
  const { startTour } = useOnboarding()
  const location = useLocation()

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const handleSignIn = async () => {
    setAuthFeedbackError(null)
    setIsAuthPending(true)

    try {
      await signInWithGoogle()
      closeMobileMenu()
    } catch (err) {
      console.error('Navbar Google Sign-In failed:', err)
      const code = err?.code || ''
      if (code === 'auth/unauthorized-domain') {
        setAuthFeedbackError('Domain not authorized in Firebase Console.')
      } else if (code === 'auth/network-request-failed') {
        setAuthFeedbackError('Network error connecting to Firebase.')
      } else {
        setAuthFeedbackError(err.message || 'Failed to sign in with Google.')
      }
    } finally {
      setIsAuthPending(false)
    }
  }

  const handleSignOut = async () => {
    setAuthFeedbackError(null)
    setIsAuthPending(true)

    try {
      await signOutUser()
      closeMobileMenu()
    } catch (err) {
      console.error('Navbar Sign-Out failed:', err)
      setAuthFeedbackError(err.message || 'Failed to sign out.')
    } finally {
      setIsAuthPending(false)
    }
  }

  const getUserInitials = (displayName, email) => {
    if (displayName && displayName.trim()) {
      return displayName
        .trim()
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    }
    if (email) {
      return email[0].toUpperCase()
    }
    return 'U'
  }

  return (
    <header className="navbar-header">
      <div className="navbar-container" data-tour="navbar-container">
        {/* Brand Logo & Name */}
        <Link to="/" className="navbar-brand" onClick={closeMobileMenu}>
          <div className="brand-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </div>
          <span className="brand-name">CampusVoice</span>
        </Link>

        {/* Navigation Links */}
        <nav
          className={`navbar-nav ${isMobileMenuOpen ? 'nav-open' : ''}`}
          aria-label="Main Navigation"
          data-tour="navbar-nav"
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={closeMobileMenu}
          >
            Home
          </NavLink>
          <NavLink
            to="/ideas"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={closeMobileMenu}
            data-tour="nav-ideas"
          >
            Ideas
          </NavLink>
          <NavLink
            to="/submit"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={closeMobileMenu}
            data-tour="nav-submit"
          >
            Submit Idea
          </NavLink>
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) => {
              const isSpecialTab =
                location.pathname === '/moderation' ||
                location.pathname === '/analytics' ||
                location.search.includes('tab=moderation-queue') ||
                location.search.includes('tab=analytics')
              return isActive && !isSpecialTab ? 'nav-link active' : 'nav-link'
            }}
            onClick={closeMobileMenu}
            data-tour="nav-dashboard"
          >
            Dashboard
          </NavLink>
          {isModerator && (
            <NavLink
              to="/dashboard?tab=moderation-queue"
              className={({ isActive }) => {
                const isModQueue =
                  location.pathname === '/moderation' ||
                  location.search.includes('tab=moderation-queue')
                return isActive || isModQueue ? 'nav-link active' : 'nav-link'
              }}
              onClick={closeMobileMenu}
            >
              Moderation
            </NavLink>
          )}
          {isModerator && (
            <NavLink
              to="/dashboard?tab=analytics"
              className={({ isActive }) => {
                const isAnalytics =
                  location.pathname === '/analytics' ||
                  location.search.includes('tab=analytics')
                return isActive || isAnalytics ? 'nav-link active' : 'nav-link'
              }}
              onClick={closeMobileMenu}
              data-testid="navbar-analytics-link"
            >
              Analytics
            </NavLink>
          )}

          {/* Authentication Controls */}
          <div className="navbar-auth-section">
            {loading ? (
              <div
                className="navbar-auth-loading-pill"
                aria-label="Resolving authentication state"
              >
                <span className="auth-spinner" aria-hidden="true" />
                <span className="auth-loading-text">Loading...</span>
              </div>
            ) : !isConfigured ? (
              <div
                className="navbar-auth-unconfigured-pill"
                title="Firebase Authentication is not configured in .env.local"
              >
                <span className="auth-dot is-warning" aria-hidden="true" />
                <span>Guest Mode</span>
              </div>
            ) : user ? (
              <div className="navbar-user-profile">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Authenticated user'}
                    className="navbar-user-avatar"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="navbar-user-avatar navbar-user-avatar-initials"
                    aria-hidden="true"
                  >
                    {getUserInitials(user.displayName, user.email)}
                  </div>
                )}

                <div className="navbar-user-info">
                  <span className="navbar-user-name">
                    {user.displayName || user.email?.split('@')[0] || 'Student'}
                  </span>
                  {isModerator && (
                    <span className="navbar-moderator-pill" title="Verified Campus Moderator">
                      Staff
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="navbar-signout-btn"
                  disabled={isAuthPending}
                  aria-label="Sign out of CampusVoice"
                >
                  {isAuthPending ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                className="navbar-signin-btn"
                disabled={isAuthPending}
                aria-label="Sign in with Google"
              >
                <svg
                  className="google-svg-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isAuthPending ? 'Signing in...' : 'Sign In'}</span>
              </button>
            )}
          </div>

          {/* New Idea Action Button */}
          <div className="navbar-actions">
            <Link
              to="/submit"
              className="navbar-cta-btn"
              onClick={closeMobileMenu}
              data-tour="submit-nav"
            >
              <span className="cta-icon" aria-hidden="true">+</span>
              New Idea
            </Link>
          </div>
        </nav>

        {/* Right Controls: Tour, Notification Bell, Theme Toggle & Mobile Menu Hamburger */}
        <div className="navbar-right-controls">
          <button
            type="button"
            className="navbar-tour-btn"
            onClick={() => startTour(true)}
            title="Take a quick tour of CampusVoice"
            aria-label="Take quick tour"
            data-testid="navbar-tour-btn"
          >
            <span className="navbar-tour-icon" aria-hidden="true">💡</span>
            <span>Tour</span>
          </button>
          {user && (
            <div data-tour="notification-bell">
              <NotificationBell key={user.uid} />
            </div>
          )}
          <ThemeToggle />
          <button
            type="button"
            className="mobile-menu-btn"
            data-tour="mobile-menu-btn"
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
          >
            <span className={`hamburger-bar ${isMobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-bar ${isMobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-bar ${isMobileMenuOpen ? 'open' : ''}`}></span>
          </button>
        </div>
      </div>

      {/* Dismissible Feedback Banner for Auth Errors */}
      {authFeedbackError && (
        <div className="navbar-auth-error-bar" role="alert">
          <span className="error-text">⚠️ {authFeedbackError}</span>
          <button
            type="button"
            className="error-dismiss-btn"
            onClick={() => setAuthFeedbackError(null)}
            aria-label="Dismiss error notice"
          >
            &times;
          </button>
        </div>
      )}
    </header>
  )
}

export default Navbar
