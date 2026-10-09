import { useParams, Link } from 'react-router-dom'
import { getMockIdeaById } from '../data/mockIdeas'
import './IdeaDetailPage.css'

function IdeaDetailPage() {
  const { id } = useParams()
  const idea = getMockIdeaById(id)

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
                <span className="upvote-number">{idea.upvotes}</span>
                <span className="upvote-word">
                  {idea.upvotes === 1 ? 'Student Upvote' : 'Student Upvotes'}
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
