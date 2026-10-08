import './IdeaCard.css'

function IdeaCard({ idea }) {
  if (!idea) return null

  const { title, description, category, status, upvotes } = idea

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

  return (
    <article className="idea-card">
      <div className="idea-card-header">
        <span className="idea-category-tag">{category}</span>
        <span className={`idea-status-badge ${getStatusClass(status)}`}>
          <span className="status-dot" aria-hidden="true" />
          {status}
        </span>
      </div>

      <div className="idea-card-body">
        <h2 className="idea-card-title">{title}</h2>
        <p className="idea-card-description">{description}</p>
      </div>

      <div className="idea-card-footer">
        <div className="idea-upvote-badge" aria-label={`${upvotes} upvotes`}>
          <span className="idea-upvote-icon" aria-hidden="true">▲</span>
          <span className="idea-upvote-count">{upvotes}</span>
          <span className="idea-upvote-label">upvotes</span>
        </div>
      </div>
    </article>
  )
}

export default IdeaCard
