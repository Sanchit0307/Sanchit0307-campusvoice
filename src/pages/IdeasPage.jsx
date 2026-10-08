import { Link } from 'react-router-dom'

function IdeasPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div className="badge">Ideas &bull; Issue #2 Shell</div>
        <h1 className="page-title">Ideas Listing</h1>
        <p className="page-subtitle">
          Browse, search, and vote on student suggestions for campus improvement.
        </p>
      </div>

      <div className="placeholder-container">
        <div className="placeholder-icon">📋</div>
        <h2 className="placeholder-title">Ideas Feed Coming Soon</h2>
        <p className="placeholder-text">
          This section is currently a placeholder for the application shell.
          The interactive ideas listing, categories, and upvoting will be built in upcoming roadmap milestones.
        </p>

        <div className="placeholder-next-steps">
          <span className="info-label">Roadmap Milestones:</span>
          <div className="tags-row">
            <span className="tag-pill">#3 Ideas Listing</span>
            <span className="tag-pill">#6 Categories &amp; Filtering</span>
            <span className="tag-pill">#7 Upvoting</span>
          </div>
        </div>

        <div className="placeholder-actions">
          <Link to="/submit" className="btn btn-primary">
            Submit an Idea Placeholder
          </Link>
          <Link to="/" className="btn btn-secondary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default IdeasPage
