import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getIdeas } from '../services/ideasService'
import IdeaCard from '../components/IdeaCard'
import EmptyState from '../components/EmptyState'
import './IdeasPage.css'

function IdeasPage() {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchIdeas = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getIdeas()
      setIdeas(data)
    } catch (err) {
      console.error('Failed to load ideas from Firestore:', err)
      setError(err.message || 'Failed to load campus proposals. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isCancelled = false

    async function loadData() {
      try {
        const data = await getIdeas()
        if (!isCancelled) {
          setIdeas(data)
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load ideas from Firestore:', err)
          setError(err.message || 'Failed to load campus proposals. Please try again.')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isCancelled = true
    }
  }, [])

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

      {/* Ideas Listing or States */}
      <section className="ideas-content-section" aria-label="Campus Ideas Listing">
        {loading ? (
          <div className="ideas-state-card" role="status" aria-live="polite">
            <div className="ideas-loading-spinner" aria-hidden="true" />
            <h2 className="ideas-state-title">Loading Campus Ideas...</h2>
            <p className="ideas-state-desc">Fetching the latest student proposals from the database.</p>
          </div>
        ) : error ? (
          <div className="ideas-state-card is-error" role="alert">
            <div className="badge not-found-badge">Database Error</div>
            <h2 className="ideas-state-title">Unable to Load Ideas</h2>
            <p className="ideas-state-desc">{error}</p>
            <div className="ideas-state-actions">
              <button type="button" onClick={fetchIdeas} className="btn btn-primary">
                Try Again
              </button>
              <Link to="/submit" className="btn btn-secondary">
                Submit an Idea
              </Link>
            </div>
          </div>
        ) : ideas.length === 0 ? (
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

            <div className="ideas-bottom-cta">
              <div className="ideas-cta-card">
                <div className="ideas-cta-content">
                  <h2 className="ideas-cta-title">Have a suggestion for campus?</h2>
                  <p className="ideas-cta-desc">
                    Every positive campus change begins with a student proposal. Share your idea with the community today.
                  </p>
                </div>
                <Link to="/submit" className="btn btn-primary">
                  + Submit an Idea
                </Link>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default IdeasPage
