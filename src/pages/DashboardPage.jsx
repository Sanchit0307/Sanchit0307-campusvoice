import { Link } from 'react-router-dom'

function DashboardPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div className="badge">Dashboard &bull; Issue #2 Shell</div>
        <h1 className="page-title">Student Dashboard</h1>
        <p className="page-subtitle">
          Manage your submitted ideas, check status updates, and view your upvoted proposals.
        </p>
      </div>

      <div className="placeholder-container">
        <div className="placeholder-icon">📊</div>
        <h2 className="placeholder-title">Dashboard Overview Coming Soon</h2>
        <p className="placeholder-text">
          This section is a structural placeholder for the application shell.
          The personalized dashboard tracking submitted proposals, upvotes, and review statuses will be connected in Issue #11.
        </p>

        <div className="placeholder-next-steps">
          <span className="info-label">Roadmap Milestones:</span>
          <div className="tags-row">
            <span className="tag-pill">#8 Authentication</span>
            <span className="tag-pill">#11 User Dashboard</span>
            <span className="tag-pill">#13 Idea Status Workflow</span>
          </div>
        </div>

        <div className="placeholder-actions">
          <Link to="/ideas" className="btn btn-primary">
            Browse Ideas
          </Link>
          <Link to="/" className="btn btn-secondary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
