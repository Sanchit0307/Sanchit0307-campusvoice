import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context'
import {
  getUserIdeas,
  getIdeas,
  updateIdeaStatus,
  rejectIdea,
  deleteIdea,
  IDEA_STATUSES,
} from '../services/ideasService'
import IdeaCard from '../components/IdeaCard'
import EmptyState from '../components/EmptyState'
import SignInPromptModal from '../components/SignInPromptModal'
import DeleteConfirmationModal from '../components/DeleteConfirmationModal'
import './DashboardPage.css'
import './IdeasPage.css'

function DashboardPage() {
  const { user, loading: authLoading, signInWithGoogle, isConfigured, isModerator } = useAuth()

  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const tabFromQuery = searchParams.get('tab')
  const wantsModeration =
    tabFromQuery === 'moderation-queue' || location.pathname === '/moderation'

  // Tab State for authorized moderators (protected: only 'moderation-queue' if isModerator is true)
  const [overrideTab, setOverrideTab] = useState(null)
  const activeTab = isModerator
    ? (overrideTab ?? (wantsModeration ? 'moderation-queue' : 'my-proposals'))
    : 'my-proposals'

  // Student Dashboard State
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signInError, setSignInError] = useState(null)

  // Moderation Queue State
  const [queueIdeas, setQueueIdeas] = useState([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueError, setQueueError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [pendingQueueStatus, setPendingQueueStatus] = useState({})
  const [updatingQueueId, setUpdatingQueueId] = useState(null)
  const [queueFeedback, setQueueFeedback] = useState(null)

  // Moderator Deletion State
  const [ideaPendingDeletion, setIdeaPendingDeletion] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteModalError, setDeleteModalError] = useState(null)

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

  const fetchQueueIdeas = useCallback(() => {
    getIdeas()
      .then((data) => {
        setQueueIdeas(data)
        setQueueError(null)
        setQueueLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load moderation queue from Firestore:', err)
        setQueueError(err.message || 'Failed to load moderation queue.')
        setQueueLoading(false)
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

  // Lazy-load moderation queue when an authorized moderator switches to that tab
  useEffect(() => {
    if (isModerator && activeTab === 'moderation-queue' && queueIdeas.length === 0) {
      fetchQueueIdeas()
    }
  }, [isModerator, activeTab, queueIdeas.length, fetchQueueIdeas])

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

  const handleQueueStatusChange = (ideaId, newStatus) => {
    setPendingQueueStatus((prev) => ({
      ...prev,
      [ideaId]: newStatus,
    }))
    setQueueFeedback(null)
  }

  const handleQueueStatusSubmit = async (ideaId, currentStatus) => {
    const targetStatus = pendingQueueStatus[ideaId] || currentStatus
    if (!ideaId || !targetStatus || targetStatus === currentStatus || updatingQueueId) {
      return
    }

    setUpdatingQueueId(ideaId)
    setQueueFeedback(null)

    try {
      await updateIdeaStatus(ideaId, targetStatus)

      setQueueIdeas((prev) =>
        prev.map((item) =>
          item.id === ideaId ? { ...item, status: targetStatus, updatedAt: 'Just now' } : item
        )
      )

      // Sync user proposals state if idea was also authored by the active moderator
      setIdeas((prev) =>
        prev.map((item) =>
          item.id === ideaId ? { ...item, status: targetStatus, updatedAt: 'Just now' } : item
        )
      )

      setQueueFeedback({
        type: 'success',
        message: `Status updated to "${targetStatus}".`,
        ideaId,
      })
    } catch (err) {
      console.error(`Failed to update status for idea ${ideaId}:`, err)
      setQueueFeedback({
        type: 'error',
        message: err.message || 'Failed to update proposal status.',
        ideaId,
      })
    } finally {
      setUpdatingQueueId(null)
    }
  }

  const handleRejectIdea = async (ideaId) => {
    if (!ideaId || updatingQueueId || isDeleting) return

    setUpdatingQueueId(ideaId)
    setQueueFeedback(null)

    try {
      await rejectIdea(ideaId)

      setQueueIdeas((prev) =>
        prev.map((item) =>
          item.id === ideaId ? { ...item, status: 'Rejected', updatedAt: 'Just now' } : item
        )
      )

      setIdeas((prev) =>
        prev.map((item) =>
          item.id === ideaId ? { ...item, status: 'Rejected', updatedAt: 'Just now' } : item
        )
      )

      setQueueFeedback({
        type: 'success',
        message: 'Proposal status updated to "Rejected".',
        ideaId,
      })
    } catch (err) {
      console.error(`Failed to reject proposal ${ideaId}:`, err)
      setQueueFeedback({
        type: 'error',
        message: err.message || 'Failed to reject proposal.',
        ideaId,
      })
    } finally {
      setUpdatingQueueId(null)
    }
  }

  const handleOpenDeleteModal = (idea) => {
    setIdeaPendingDeletion(idea)
    setDeleteModalError(null)
  }

  const handleCloseDeleteModal = () => {
    if (isDeleting) return
    setIdeaPendingDeletion(null)
    setDeleteModalError(null)
  }

  const handleConfirmDelete = async () => {
    if (!ideaPendingDeletion?.id || isDeleting) return

    const targetId = ideaPendingDeletion.id
    const targetTitle = ideaPendingDeletion.title || 'Proposal'
    setIsDeleting(true)
    setDeleteModalError(null)

    try {
      await deleteIdea(targetId)

      // Immediately remove from active lists
      setQueueIdeas((prev) => prev.filter((item) => item.id !== targetId))
      setIdeas((prev) => prev.filter((item) => item.id !== targetId))

      setQueueFeedback({
        type: 'success',
        message: `Proposal "${targetTitle}" and all associated votes were permanently removed.`,
        ideaId: null,
      })

      setIdeaPendingDeletion(null)
    } catch (err) {
      console.error(`Failed to delete proposal ${targetId}:`, err)
      setDeleteModalError(err.message || 'Failed to delete proposal. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Calculate high-level summary metrics for student dashboard
  const totalSubmissions = ideas.length
  const underReviewCount = ideas.filter((i) => i.status === 'Under Review').length
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

  // Filter moderation queue items
  const filteredQueueIdeas = queueIdeas.filter((idea) => {
    if (statusFilter === 'All') return true
    return idea.status === statusFilter
  })

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <h1 className="page-title">
            {user
              ? activeTab === 'moderation-queue' && isModerator
                ? 'Campus Moderation Queue'
                : user.displayName
                  ? `${user.displayName}'s Dashboard`
                  : 'Student Dashboard'
              : 'Student Dashboard'}
          </h1>
          <p className="page-subtitle">
            {activeTab === 'moderation-queue' && isModerator
              ? 'Review campus submissions, advance proposal lifecycle stages, and monitor community momentum.'
              : 'Track the status of your campus proposals, monitor community upvotes, and see administrative reviews in one place.'}
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
      ) : (
        /* Authenticated View */
        <>
          {/* Moderator View Switcher (Exclusively available when isModerator === true) */}
          {isModerator && (
            <nav className="dashboard-tab-bar" role="tablist" aria-label="Dashboard Views">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'my-proposals'}
                className={`dashboard-tab-btn ${activeTab === 'my-proposals' ? 'active' : ''}`}
                onClick={() => {
                  setOverrideTab('my-proposals')
                  setSearchParams({})
                }}
              >
                <span>👤 My Proposals</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'moderation-queue'}
                className={`dashboard-tab-btn ${activeTab === 'moderation-queue' ? 'active' : ''}`}
                onClick={() => {
                  setOverrideTab('moderation-queue')
                  setSearchParams({ tab: 'moderation-queue' })
                  if (queueIdeas.length === 0) {
                    setQueueLoading(true)
                    fetchQueueIdeas()
                  }
                }}
              >
                <span>🛡️ Moderation Queue</span>
                <span className="moderator-badge-pill">Staff</span>
              </button>
            </nav>
          )}

          {activeTab === 'moderation-queue' && isModerator ? (
            /* Moderation Queue View (Restricted to Authorized Moderators) */
            <section className="moderation-queue-container" aria-label="Staff Moderation Queue">
              {/* Filter Bar */}
              <div className="moderation-filter-bar" role="toolbar" aria-label="Filter queue by status">
                <span className="moderation-filter-label">Filter Status:</span>
                <button
                  type="button"
                  className={`moderation-filter-pill ${statusFilter === 'All' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('All')}
                >
                  All ({queueIdeas.length})
                </button>
                {IDEA_STATUSES.map((statusName) => {
                  const count = queueIdeas.filter((i) => i.status === statusName).length
                  return (
                    <button
                      key={statusName}
                      type="button"
                      className={`moderation-filter-pill ${statusFilter === statusName ? 'active' : ''}`}
                      onClick={() => setStatusFilter(statusName)}
                    >
                      {statusName} ({count})
                    </button>
                  )
                })}
              </div>

              {queueFeedback && !queueFeedback.ideaId && (
                <div
                  className={`moderator-queue-feedback ${
                    queueFeedback.type === 'success' ? 'is-success' : 'is-error'
                  }`}
                  role={queueFeedback.type === 'success' ? 'status' : 'alert'}
                >
                  <span>{queueFeedback.type === 'success' ? '✓' : '⚠️'} {queueFeedback.message}</span>
                </div>
              )}

              {/* Queue Content State */}
              {queueLoading ? (
                <div className="ideas-state-card" role="status" aria-live="polite">
                  <div className="ideas-loading-spinner" aria-hidden="true" />
                  <h2 className="ideas-state-title">Loading Moderation Queue...</h2>
                  <p className="ideas-state-desc">Fetching campus proposals for review.</p>
                </div>
              ) : queueError ? (
                <div className="ideas-state-card is-error" role="alert">
                  <div className="badge not-found-badge">Database Error</div>
                  <h2 className="ideas-state-title">Unable to Load Moderation Queue</h2>
                  <p className="ideas-state-desc">{queueError}</p>
                  <div className="ideas-state-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setQueueLoading(true)
                        setQueueError(null)
                        fetchQueueIdeas()
                      }}
                      className="btn btn-primary"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : filteredQueueIdeas.length === 0 ? (
                <EmptyState
                  title="No Proposals in Queue"
                  description={
                    statusFilter === 'All'
                      ? 'There are currently no proposals in the campus database.'
                      : `There are currently no proposals matching the "${statusFilter}" status.`
                  }
                  actionText={statusFilter !== 'All' ? 'View All Statuses' : '+ Submit an Idea'}
                  actionLink={statusFilter !== 'All' ? undefined : '/submit'}
                  onClick={statusFilter !== 'All' ? () => setStatusFilter('All') : undefined}
                />
              ) : (
                <div className="moderation-queue-list">
                  {filteredQueueIdeas.map((idea) => {
                    const currentSelected = pendingQueueStatus[idea.id] || idea.status
                    const isUpdatingThis = updatingQueueId === idea.id
                    const feedback = queueFeedback?.ideaId === idea.id ? queueFeedback : null

                    return (
                      <article key={idea.id} className="moderation-item-card">
                        <div className="moderation-item-header">
                          <div>
                            <h3 className="moderation-item-title">
                              <Link to={`/ideas/${idea.id}`} className="moderation-item-title-link">
                                {idea.title}
                              </Link>
                            </h3>
                            <div className="moderation-item-meta">
                              <span>📁 {idea.category}</span>
                              <span>&bull;</span>
                              <span>👤 {idea.authorName || 'Anonymous Student'}</span>
                              <span>&bull;</span>
                              <span>🕒 {idea.createdAt}</span>
                            </div>
                          </div>

                          <div className="idea-upvote-badge" aria-label={`${idea.upvoteCount ?? 0} upvotes`}>
                            <span className="idea-upvote-icon" aria-hidden="true">▲</span>
                            <span className="idea-upvote-count">
                              {idea.upvoteCount !== null ? idea.upvoteCount : '—'}
                            </span>
                            <span className="idea-upvote-label">upvotes</span>
                          </div>
                        </div>

                        <p className="moderation-item-body">{idea.description}</p>

                        {feedback && (
                          <div
                            className={`moderator-item-feedback ${
                              feedback.type === 'success' ? 'is-success' : 'is-error'
                            }`}
                            role={feedback.type === 'success' ? 'status' : 'alert'}
                          >
                            <span>{feedback.type === 'success' ? '✓' : '⚠️'} {feedback.message}</span>
                          </div>
                        )}

                        <div className="moderation-item-footer">
                          <div className="moderation-control-bar">
                            <label htmlFor={`queue-status-${idea.id}`} className="moderation-select-label">
                              Status:
                            </label>
                            <select
                              id={`queue-status-${idea.id}`}
                              className="moderation-status-dropdown"
                              value={currentSelected}
                              onChange={(e) => handleQueueStatusChange(idea.id, e.target.value)}
                              disabled={isUpdatingThis}
                            >
                              {IDEA_STATUSES.map((statusName) => (
                                <option key={statusName} value={statusName}>
                                  {statusName} {statusName === idea.status ? '(Current)' : ''}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              className="btn btn-primary moderation-apply-btn"
                              onClick={() => handleQueueStatusSubmit(idea.id, idea.status)}
                              disabled={isUpdatingThis || currentSelected === idea.status || isDeleting}
                            >
                              {isUpdatingThis ? 'Updating...' : 'Update Status'}
                            </button>

                            {idea.status !== 'Rejected' && (
                              <button
                                type="button"
                                className="moderation-reject-btn"
                                onClick={() => handleRejectIdea(idea.id)}
                                disabled={isUpdatingThis || isDeleting}
                                aria-label={`Reject proposal: ${idea.title}`}
                              >
                                Reject
                              </button>
                            )}

                            <button
                              type="button"
                              className="moderation-delete-btn"
                              onClick={() => handleOpenDeleteModal(idea)}
                              disabled={isUpdatingThis || isDeleting}
                              aria-label={`Remove proposal: ${idea.title}`}
                            >
                              Remove
                            </button>
                          </div>

                          <Link to={`/ideas/${idea.id}`} className="idea-card-view-link">
                            View Details &rarr;
                          </Link>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          ) : (
            /* Student Proposals View (Existing Phase 1 View) */
            <>
              {loading ? (
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
            </>
          )}
        </>
      )}

      {/* Reusable Accessible Auth Modal */}
      <SignInPromptModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        title="Sign In to Student Dashboard"
        description="Sign in with your student Google account to track the status of your submitted campus proposals and see community engagement."
      />

      {/* Confirmation Modal for Permanent Idea Removal */}
      <DeleteConfirmationModal
        isOpen={Boolean(ideaPendingDeletion)}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        ideaTitle={ideaPendingDeletion?.title || ''}
        isDeleting={isDeleting}
        error={deleteModalError}
      />
    </div>
  )
}

export default DashboardPage
