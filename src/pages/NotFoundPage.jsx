import { Link } from 'react-router-dom'
import './NotFoundPage.css'

function NotFoundPage() {
  return (
    <div className="page-container not-found-container">
      <div className="not-found-card" role="region" aria-label="Page not found notice">
        <span className="not-found-badge">Error 404</span>
        <div className="not-found-code" aria-hidden="true">
          404
        </div>
        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-desc">
          The campus page, proposal, or resource you are looking for does not exist or has been moved within the CampusVoice portal.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">
            Return to Home
          </Link>
          <Link to="/ideas" className="btn btn-secondary">
            Browse Proposals
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
