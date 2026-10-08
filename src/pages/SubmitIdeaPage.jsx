import { Link } from 'react-router-dom'

function SubmitIdeaPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div className="badge">Submit an Idea &bull; Issue #2 Shell</div>
        <h1 className="page-title">Submit an Idea</h1>
        <p className="page-subtitle">
          Propose new changes, improvements, or initiatives for the student body and campus administration.
        </p>
      </div>

      <div className="placeholder-container">
        <div className="placeholder-icon">✍️</div>
        <h2 className="placeholder-title">Submission Form Coming Soon</h2>
        <p className="placeholder-text">
          This section is a structural placeholder for the application shell.
          The complete submission form with title, category, description, and validation will be implemented in Issue #4.
        </p>

        <div className="placeholder-next-steps">
          <span className="info-label">Roadmap Milestones:</span>
          <div className="tags-row">
            <span className="tag-pill">#4 Idea Submission</span>
            <span className="tag-pill">#8 Authentication</span>
            <span className="tag-pill">#10 Data/API Layer</span>
          </div>
        </div>

        <div className="placeholder-actions">
          <Link to="/ideas" className="btn btn-primary">
            View Ideas Section
          </Link>
          <Link to="/" className="btn btn-secondary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SubmitIdeaPage
