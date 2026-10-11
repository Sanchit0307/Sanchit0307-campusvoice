import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context'
import { getUserIdeas } from '../services/ideasService'
import IdeaCard from '../components/IdeaCard'
import EmptyState from '../components/EmptyState'
import SignInPromptModal from '../components/SignInPromptModal'
import './DashboardPage.css'
import './IdeasPage.css'

function DashboardPage() {
  const { user, loading: authLoading, signInWithGoogle, isConfigured } = useAuth()

  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signInError, setSignInError] = useState(null)

  const activeUserIdRef = useRef(null)

  const fetchUserIdeas = useCallback((userId) => {
    if (!userId) {
      return
    }

    activeUserIdRef.current = userId

    getUserIdeas(userId)
      .then((data) => {
        if (activeUserIdRef.current === userId) {
          setIdeas(data)
          setError(null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (activeUserIdRef.current === userId) {
          console.error('Failed to load user ideas from Firestore:', err)
          setError(err.message || 'Failed to load your submitted proposals. Please try again.')
          setLoading(false)
        }
      })
  }, [])

  useEffect(() => {
    // Never query Firestore if auth is resolving or if user is signed out
    if (authLoading || !user?.uid) {
      activeUserIdRef.current = null
      return undefined
    }

    // Reuse fetchUserIdeas callback for initial loading
    fetchUserIdeas(user.uid)

    return () => {
      activeUserIdRef.current = null
    }
  }, [authLoading, user?.uid, fetchUserIdeas])

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return

    if (!isConfigured) {
      setSignInError('Firebase Authentication is not configured in this environment.')
      return
    }

    setSignInError(null)
    setIsSigningIn(true)

    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('Dashboard Sign-In failed:', err)
      const code = err?.code || ''
      if (code === 'auth/popup-closed-by-user') {
        // User voluntarily closed popup
        setSignInError(null)
      } else if (code === 'auth/unauthorized-domain') {
        setSignInError('This domain is not authorized in Firebase Console.')
      } else if (code === 'auth/network-request-failed') {
        setSignInError('Network error connecting to Firebase. Please check your connection.')
      } else {
        setSignInError(err.message || 'Failed to sign in with Google.')
      }
    } finally {
      setIsSigningIn(false)
    }
  }

  // Calculate high-level summary metrics
  const totalSubmissions = ideas.length

  // Accurately counts proposals strictly in the existing 'Under Review' status
  const underReviewCount = ideas.filter((i) => i.status === 'Under Review').length

  // Check if any idea's live vote count is explicitly unavailable (null)
  const hasUnavailableVoteCount = ideas.some(
    (i) => i.upvoteCount === null || (i.upvoteCount === undefined && i.upvotes === null)
  )

  const totalVotesReceived = hasUnavailableVoteCount
    ? null
    : ideas.reduce((sum, i) => {
        const count =
          typeof i.upvoteCount === 'number'
            ? i.upvoteCount
            : typeof i.upvotes === 'number'
              ? i.upvotes
              : 0
        return sum + count
      }, 0)

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="badge">Dashboard &bull; Student Hub</div>
          <h1 className="page-title">
            {user ? (user.displayName ? `${user.displayName}'s Dashboard` : 'Student Dashboard') : 'Student Dashboard'}
          </h1>
          <p className="page-subtitle">
            Track the status of your campus proposals, monitor community upvotes, and see administrative reviews in one place.
          </p>
        </div>

        {user && (
          <div className="dashboard-header-action">
            <Link to="/submit" className="btn btn-primary">
              + Submit an Idea
            </Link>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {authLoading ? (
        /* Resolving Auth State */
        <div className="ideas-state-card" role="status" aria-live="polite">
          <div className="ideas-loading-spinner" aria-hidden="true" />
          <h2 className="ideas-state-title">Checking Authentication...</h2>
          <p className="ideas-state-desc">Resolving your student sign-in status.</p>
        </div>
      ) : !user ? (
        /* Guest / Signed-Out State */
        <div className="dashboard-guest-card" role="region" aria-label="Sign-in prompt for guest users">
          <div className="dashboard-guest-icon-badge" aria-hidden="true">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </div>

          <h2 className="dashboard-guest-title">Sign in to Access Your Dashboard</h2>
          <p className="dashboard-guest-desc">
            Your personalized dashboard tracks the proposals you submit, their current lifecycle status, and community upvotes from fellow students.
          </p>

          <div className="dashboard-guest-actions">
            <button
              type="button"
              className="dashboard-google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              aria-label="Sign in with Google"
            >
              <svg
                className="google-svg-icon"
                width="18"
                height="18"
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
              <span>{isSigningIn ? 'Signing in...' : 'Sign In with Google'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSignInModalOpen(true)}
            >
              Why Sign In?
            </button>

            <Link to="/ideas" className="btn btn-secondary">
              Browse Campus Ideas
            </Link>
          </div>

          {signInError && (
            <div className="dashboard-auth-error" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{signInError}</span>
            </div>
          )}
        </div>
      ) : loading ? (
        /* Loading Proposals */
        <div className="ideas-state-card" role="status" aria-live="polite">
          <div className="ideas-loading-spinner" aria-hidden="true" />
          <h2 className="ideas-state-title">Loading Your Dashboard...</h2>
          <p className="ideas-state-desc">Fetching your submitted campus proposals from Firestore.</p>
        </div>
      ) : error ? (
        /* Error State */
        <div className="ideas-state-card is-error" role="alert">
          <div className="badge not-found-badge">Database Error</div>
          <h2 className="ideas-state-title">Unable to Load Proposals</h2>
          <p className="ideas-state-desc">{error}</p>
          <div className="ideas-state-actions">
            <button
              type="button"
              onClick={() => {
                if (user?.uid) {
                  setLoading(true)
                  setError(null)
                  fetchUserIdeas(user.uid)
                }
              }}
              className="btn btn-primary"
            >
              Try Again
            </button>
            <Link to="/ideas" className="btn btn-secondary">
              Browse All Ideas
            </Link>
          </div>
        </div>
      ) : ideas.length === 0 ? (
        /* Empty State */
        <EmptyState
          title="No Proposals Submitted Yet"
          description="You haven't submitted any proposals to CampusVoice yet. Have a suggestion to improve facilities, academics, or student life?"
          actionText="+ Submit Your First Idea"
          actionLink="/submit"
        />
      ) : (
        /* Populated Dashboard */
        <section aria-label="Student Proposal Dashboard">
          {/* Overview Metrics Cards */}
          <div className="dashboard-stats-grid">
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon-wrapper" aria-hidden="true">
                📋
              </div>
              <div className="dashboard-stat-content">
                <span className="dashboard-stat-number">{totalSubmissions}</span>
                <span className="dashboard-stat-label">
                  {totalSubmissions === 1 ? 'Submitted Proposal' : 'Submitted Proposals'}
                </span>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon-wrapper is-status" aria-hidden="true">
                ⏳
              </div>
              <div className="dashboard-stat-content">
                <span className="dashboard-stat-number">{underReviewCount}</span>
                <span className="dashboard-stat-label">Under Review</span>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon-wrapper is-votes" aria-hidden="true">
                ▲
              </div>
              <div className="dashboard-stat-content">
                <span className="dashboard-stat-number">
                  {totalVotesReceived !== null ? totalVotesReceived : 'Unavailable'}
                </span>
                <span className="dashboard-stat-label">
                  {totalVotesReceived !== null ? 'Total Upvotes Received' : 'Total Upvotes (Unavailable)'}
                </span>
              </div>
            </div>
          </div>

          {/* User Proposals Section Header */}
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Your Submitted Proposals</h2>
            <span className="dashboard-count-badge">
              Showing {ideas.length} {ideas.length === 1 ? 'proposal' : 'proposals'}
            </span>
          </div>

          {/* Grid of Idea Cards */}
          <div className="ideas-grid">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        </section>
      )}

      {/* Reusable Accessible Auth Modal */}
      <SignInPromptModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        title="Sign In to Student Dashboard"
        description="Sign in with your student Google account to track the status of your submitted campus proposals and see community engagement."
      />
    </div>
  )
}

export default DashboardPage
