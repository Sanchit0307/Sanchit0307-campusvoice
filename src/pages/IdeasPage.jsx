import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mockIdeas } from '../data/mockIdeas'
import IdeaCard from '../components/IdeaCard'
import EmptyState from '../components/EmptyState'
import './IdeasPage.css'

function IdeasPage() {
  const [ideas] = useState(mockIdeas)

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="ideas-page-header">
        <div className="ideas-header-content">
          <div className="badge">Ideas &bull; Student Proposals</div>
          <h1 className="page-title">Campus Ideas</h1>
          <p className="page-subtitle">
            Browse suggestions submitted by fellow students, track progress across lifecycle stages,
            and see what initiatives are gaining campus momentum.
          </p>
        </div>

        <div className="ideas-header-action">
          <Link to="/submit" className="btn btn-primary">
            + Submit an Idea
          </Link>
        </div>
      </div>

      {/* Ideas Listing or Empty State */}
      <section className="ideas-content-section" aria-label="Campus Ideas Listing">
        {ideas.length === 0 ? (
          <EmptyState
            title="No Campus Ideas Yet"
            description="There are currently no proposals in the feed. Be the first to suggest a campus improvement!"
            actionText="Submit the First Idea"
            actionLink="/submit"
          />
        ) : (
          <>
            <div className="ideas-meta-bar">
              <span className="ideas-count-badge">
                Showing {ideas.length} {ideas.length === 1 ? 'proposal' : 'proposals'}
              </span>
            </div>

            <div className="ideas-grid">
              {ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default IdeasPage
