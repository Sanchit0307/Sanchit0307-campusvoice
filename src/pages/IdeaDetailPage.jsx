import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getIdeaById, updateIdeaStatus, IDEA_STATUSES } from '../services/ideasService'
import { useAuth } from '../context'
import './IdeaDetailPage.css'

function IdeaDetailPage() {
  const { id } = useParams()
  const { isModerator } = useAuth()
  const [idea, setIdea] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusUpdateMessage, setStatusUpdateMessage] = useState(null)
  const [statusUpdateError, setStatusUpdateError] = useState(null)

  const loadIdea = async () => {
    if (!id) {
      setIdea(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const fetchedIdea = await getIdeaById(id)
      setIdea(fetchedIdea)
    } catch (err) {
      console.error(`Failed to load idea "${id}" from Firestore:`, err)
      setError(err.message || 'Failed to load idea details from the database.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isCancelled = false

    if (!id) {
      return
    }

    async function fetchData() {
      try {
        const fetchedIdea = await getIdeaById(id)
        if (!isCancelled) {
          setIdea(fetchedIdea)
        }
      } catch (err) {
        if (!isCancelled) {
          console.error(`Failed to load idea "${id}" from Firestore:`, err)
          setError(err.message || 'Failed to load idea details from the database.')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isCancelled = true
    }
  }, [id])

  const getStatusClass = (statusName) => {
    switch (statusName) {
      case 'Under Review':
        return 'status-under-review'
      case 'In Progress':
        return 'status-in-progress'
      case 'Accepted':
        return 'status-accepted'
      case 'Implemented':
        return 'status-implemented'
      case 'Submitted':
      default:
        return 'status-submitted'
    }
  }

  const getStatusDescription = (statusName) => {
    switch (statusName) {
      case 'Under Review':
        return 'Campus administration and student representatives are actively reviewing the feasibility, logistics, and budget of this proposal.'
      case 'In Progress':
        return 'Relevant campus departments are actively executing this initiative to bring the proposal to life.'
      case 'Accepted':
        return 'This proposal was approved and prioritized for upcoming campus planning and implementation.'
      case 'Implemented':
        return 'This campus enhancement has been successfully delivered and is active for the student community.'
      case 'Submitted':
      default:
        return 'This proposal has been posted to the campus portal and is gathering community visibility and feedback.'
    }
  }

  const handleStatusUpdate = async (e) => {
    e.preventDefault()
    if (!id || !selectedStatus || !idea || selectedStatus === idea.status || isUpdatingStatus) {
      return
    }

    setIsUpdatingStatus(true)
    setStatusUpdateError(null)
    setStatusUpdateMessage(null)

    try {
      await updateIdeaStatus(id, selectedStatus)
      setIdea((prev) => ({
        ...prev,
        status: selectedStatus,
        updatedAt: 'Just now',
      }))
      setStatusUpdateMessage(`Proposal status successfully updated to "${selectedStatus}".`)
    } catch (err) {
      console.error('Failed to update proposal status:', err)
      setStatusUpdateError(err.message || 'Failed to update proposal status.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="ideas-state-card" role="status" aria-live="polite">
          <div className="ideas-loading-spinner" aria-hidden="true" />
          <h2 className="ideas-state-title">Loading Proposal Details...</h2>
          <p className="ideas-state-desc">Fetching proposal information from the database.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="idea-not-found-card" role="alert" aria-live="assertive">
          <div className="not-found-icon-wrap" aria-hidden="true">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="badge not-found-badge">Database Error</div>
          <h1 className="not-found-title">Unable to Load Proposal</h1>
          <p className="not-found-message">{error}</p>
          <div className="not-found-actions">
            <button type="button" onClick={loadIdea} className="btn btn-primary">
              Try Again
            </button>
            <Link to="/ideas" className="btn btn-secondary">
              &larr; Back to Ideas Listing
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Handle invalid or missing idea IDs gracefully
  if (!idea) {
    return (
      <div className="page-container">
        <div className="idea-not-found-card" role="alert" aria-live="assertive">
          <div className="not-found-icon-wrap" aria-hidden="true">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <div className="badge not-found-badge">Proposal Not Found</div>
          <h1 className="not-found-title">Idea Not Found</h1>
          <p className="not-found-message">
            We couldn&apos;t find an idea with the identifier{' '}
            <code className="not-found-code">&quot;{id || 'unknown'}&quot;</code>. The proposal may
            have been archived, removed, or the link may be mistyped.
          </p>
          <div className="not-found-actions">
            <Link to="/ideas" className="btn btn-primary">
              &larr; Back to Ideas Listing
            </Link>
            <Link to="/submit" className="btn btn-secondary">
              + Submit a New Idea
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container idea-detail-page">
      {/* Navigation Breadcrumb / Top Bar */}
      <nav className="detail-top-nav" aria-label="Breadcrumb">
        <Link to="/ideas" className="back-link">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Ideas
        </Link>
        <span className="breadcrumb-divider" aria-hidden="true">/</span>
        <span className="breadcrumb-category">{idea.category}</span>
        <span className="breadcrumb-divider" aria-hidden="true">/</span>
        <span className="breadcrumb-current-id">{idea.id}</span>
      </nav>

      {/* Main Detail Header Card */}
      <header className="idea-detail-header-card">
        <div className="idea-detail-meta-row">
          <div className="detail-tags-group">
            <span className="idea-category-tag">{idea.category}</span>
            <span className={`idea-status-badge ${getStatusClass(idea.status)}`}>
              <span className="status-dot" aria-hidden="true" />
              {idea.status}
            </span>
          </div>

          {idea.createdAt && (
            <span className="idea-detail-timestamp">
              Posted {idea.createdAt}
            </span>
          )}
        </div>

        <h1 className="idea-detail-title">{idea.title}</h1>
      </header>

      {/* Detail Content Grid */}
      <div className="idea-detail-layout">
        {/* Left Column: Full Description & Lifecycle Stage */}
        <section className="detail-main-content">
          <div className="detail-section-card">
            <h2 className="detail-section-title">
              <span className="detail-section-icon" aria-hidden="true">📋</span>
              Proposal Description
            </h2>
            <p className="idea-detail-full-description">{idea.description}</p>
          </div>

          <div className="detail-section-card status-info-card">
            <div className="status-info-header">
              <span className="detail-section-icon" aria-hidden="true">🔄</span>
              <div>
                <h3 className="status-info-title">Status: {idea.status}</h3>
                <p className="status-info-desc">{getStatusDescription(idea.status)}</p>
              </div>
            </div>
          </div>

          {/* Moderator Workflow Controls */}
          {isModerator && (
            <div className="detail-section-card moderator-control-card" aria-label="Moderator Workflow Controls">
              <div className="moderator-card-header">
                <span className="detail-section-icon" aria-hidden="true">🛡️</span>
                <div>
                  <h3 className="moderator-card-title">Moderator Workflow Controls</h3>
                  <p className="moderator-card-subtitle">
                    Advance or update this proposal&apos;s review stage. Only authorized campus moderators can make these updates.
                  </p>
                </div>
              </div>

              {statusUpdateMessage && (
                <div className="moderator-alert is-success" role="status">
                  <span>✓ {statusUpdateMessage}</span>
                </div>
              )}

              {statusUpdateError && (
                <div className="moderator-alert is-error" role="alert">
                  <span>⚠️ {statusUpdateError}</span>
                </div>
              )}

              <form onSubmit={handleStatusUpdate} className="moderator-status-form">
                <div className="moderator-status-row">
                  <label htmlFor="moderator-status-select" className="moderator-status-label">
                    Change Status:
                  </label>
                  <select
                    id="moderator-status-select"
                    className="moderator-status-select"
                    value={selectedStatus || idea.status}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value)
                      setStatusUpdateMessage(null)
                      setStatusUpdateError(null)
                    }}
                    disabled={isUpdatingStatus}
                  >
                    {IDEA_STATUSES.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption} {statusOption === idea.status ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    className="btn btn-primary moderator-update-btn"
                    disabled={isUpdatingStatus || (selectedStatus && selectedStatus === idea.status)}
                  >
                    {isUpdatingStatus ? 'Updating Status...' : 'Apply Status Update'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="detail-page-bottom-nav">
            <Link to="/ideas" className="btn btn-secondary">
              &larr; Back to Ideas
            </Link>
            <Link to="/submit" className="btn btn-primary">
              + Propose Another Idea
            </Link>
          </div>
        </section>

        {/* Right Column: Upvote Summary & Metadata */}
        <aside className="detail-sidebar" aria-label="Proposal details and community support">
          {/* Upvotes Summary Card */}
          <div className="detail-sidebar-card upvote-summary-card">
            <div className="upvote-highlight">
              <span className="upvote-highlight-arrow" aria-hidden="true">▲</span>
              <div className="upvote-highlight-numbers">
                <span className="upvote-number">
                  {typeof idea.upvoteCount === 'number' ? idea.upvoteCount : (typeof idea.upvotes === 'number' ? idea.upvotes : 0)}
                </span>
                <span className="upvote-word">
                  {(typeof idea.upvoteCount === 'number' ? idea.upvoteCount : (typeof idea.upvotes === 'number' ? idea.upvotes : 0)) === 1 ? 'Student Upvote' : 'Student Upvotes'}
                </span>
              </div>
            </div>
            <p className="upvote-support-text">
              Community upvotes show campus administrators which ideas have the highest student backing.
            </p>
          </div>

          {/* Proposal Attributes Card */}
          <div className="detail-sidebar-card meta-summary-card">
            <h3 className="sidebar-card-title">Proposal Details</h3>
            <dl className="meta-dl">
              <div className="meta-dl-row">
                <dt className="meta-dl-term">Identifier</dt>
                <dd className="meta-dl-def">
                  <code>{idea.id}</code>
                </dd>
              </div>
              <div className="meta-dl-row">
                <dt className="meta-dl-term">Category</dt>
                <dd className="meta-dl-def">{idea.category}</dd>
              </div>
              {idea.authorName && (
                <div className="meta-dl-row">
                  <dt className="meta-dl-term">Author</dt>
                  <dd className="meta-dl-def">{idea.authorName}</dd>
                </div>
              )}
              <div className="meta-dl-row">
                <dt className="meta-dl-term">Current Status</dt>
                <dd className="meta-dl-def">
                  <span className={`idea-status-badge ${getStatusClass(idea.status)}`}>
                    <span className="status-dot" aria-hidden="true" />
                    {idea.status}
                  </span>
                </dd>
              </div>
              {idea.createdAt && (
                <div className="meta-dl-row">
                  <dt className="meta-dl-term">Submitted</dt>
                  <dd className="meta-dl-def">{idea.createdAt}</dd>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default IdeaDetailPage
