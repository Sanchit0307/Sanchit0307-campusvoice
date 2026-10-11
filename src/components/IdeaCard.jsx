import { useNavigate, Link } from 'react-router-dom'
import './IdeaCard.css'

function IdeaCard({ idea }) {
  const navigate = useNavigate()

  if (!idea) return null

  const { id, title, description, category, status, upvotes, upvoteCount } = idea
  const isVoteCountUnavailable =
    upvoteCount === null || (upvoteCount === undefined && upvotes === null)
  const displayUpvotes = isVoteCountUnavailable
    ? null
    : typeof upvoteCount === 'number'
      ? upvoteCount
      : typeof upvotes === 'number'
        ? upvotes
        : 0

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

  const handleCardClick = (e) => {
    // Prevent unintended card navigation if the user interacts with interactive elements
    if (e.target.closest('button, a, input, select, textarea, [data-prevent-card-nav]')) {
      return
    }
    if (id) {
      navigate(`/ideas/${id}`)
    }
  }

  return (
    <article
      className="idea-card clickable-idea-card"
      onClick={handleCardClick}
    >
      <div className="idea-card-header">
        <span className="idea-category-tag">{category}</span>
        <span className={`idea-status-badge ${getStatusClass(status)}`}>
          <span className="status-dot" aria-hidden="true" />
          {status}
        </span>
      </div>

      <div className="idea-card-body">
        <h2 className="idea-card-title">
          {id ? (
            <Link to={`/ideas/${id}`} className="idea-card-title-link">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        <p className="idea-card-description">{description}</p>
      </div>

      <div className="idea-card-footer">
        <div
          className="idea-upvote-badge"
          aria-label={
            isVoteCountUnavailable
              ? 'Vote count unavailable'
              : `${displayUpvotes} ${displayUpvotes === 1 ? 'upvote' : 'upvotes'}`
          }
        >
          <span className="idea-upvote-icon" aria-hidden="true">▲</span>
          <span className="idea-upvote-count">
            {isVoteCountUnavailable ? 'Unavailable' : displayUpvotes}
          </span>
          {!isVoteCountUnavailable && <span className="idea-upvote-label">upvotes</span>}
        </div>

        {id && (
          <Link
            to={`/ideas/${id}`}
            className="idea-card-view-link"
            aria-label={`View details for ${title}`}
          >
            View Details &rarr;
          </Link>
        )}
      </div>
    </article>
  )
}

export default IdeaCard
