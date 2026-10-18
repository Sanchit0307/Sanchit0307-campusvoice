import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="page-container">
      <div className="placeholder-container">
        <h1 className="page-title">Page Not Found</h1>
        <p className="placeholder-text">
          The page you are looking for does not exist in the CampusVoice portal shell.
        </p>
        <div className="placeholder-actions">
          <Link to="/" className="btn btn-primary">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
