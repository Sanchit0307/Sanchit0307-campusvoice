import { Link } from 'react-router-dom'
import './EmptyState.css'

function EmptyState({
  title = 'No Ideas Found',
  description = 'There are no campus suggestions posted yet. Be the first student to submit an idea!',
  actionText = 'Submit an Idea',
  actionLink = '/submit',
  onClick,
}) {
  return (
    <div className="empty-state-card" role="region" aria-label="Empty ideas state">
      <div className="empty-state-icon" aria-hidden="true">💡</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {actionLink && actionText ? (
        <Link to={actionLink} className="btn btn-primary empty-state-btn">
          {actionText}
        </Link>
      ) : onClick && actionText ? (
        <button
          type="button"
          onClick={onClick}
          className="btn btn-primary empty-state-btn"
        >
          {actionText}
        </button>
      ) : null}
    </div>
  )
}

export default EmptyState
