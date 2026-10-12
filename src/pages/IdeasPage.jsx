import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getIdeas, IDEA_STATUSES } from '../services/ideasService'
import { IDEA_CATEGORIES } from '../data/mockIdeas'
import { useAuth } from '../context'
import IdeaCard from '../components/IdeaCard'
import EmptyState from '../components/EmptyState'
import './IdeasPage.css'

/**
 * Safely extracts a numeric epoch timestamp (in milliseconds) from an idea's
 * createdAtRaw or createdAt fields. Handles Firestore Timestamps, serialized timestamps,
 * JS Dates, and ISO/date strings, falling back to 0 for missing or invalid dates.
 *
 * @param {object} idea
 * @returns {number}
 */
function getIdeaTimestampValue(idea) {
  if (!idea) return 0

  const raw = idea.createdAtRaw
  if (raw) {
    if (typeof raw.toMillis === 'function') {
      try {
        return raw.toMillis()
      } catch {
        // Fall through
      }
    }
    if (typeof raw.toDate === 'function') {
      try {
        const d = raw.toDate()
        if (d instanceof Date && !isNaN(d.getTime())) {
          return d.getTime()
        }
      } catch {
        // Fall through
      }
    }
    if (typeof raw === 'object' && typeof raw.seconds === 'number') {
      const nanos = typeof raw.nanoseconds === 'number' ? raw.nanoseconds / 1e6 : 0
      return raw.seconds * 1000 + nanos
    }
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return raw.getTime()
    }
    if (typeof raw === 'number' && !isNaN(raw)) {
      return raw
    }
    if (typeof raw === 'string') {
      const parsed = Date.parse(raw)
      if (!isNaN(parsed)) {
        return parsed
      }
    }
  }

  // Fallback to idea.createdAt if createdAtRaw is not parseable
  if (idea.createdAt) {
    if (idea.createdAt instanceof Date && !isNaN(idea.createdAt.getTime())) {
      return idea.createdAt.getTime()
    }
    if (typeof idea.createdAt === 'string') {
      const parsed = Date.parse(idea.createdAt)
      if (!isNaN(parsed)) {
        return parsed
      }
    }
  }

  return 0
}

/**
 * Safely extracts an upvote count from an idea, falling back gracefully to 0.
 *
 * @param {object} idea
 * @returns {number}
 */
function getIdeaVoteCount(idea) {
  if (!idea) return 0
  if (typeof idea.upvoteCount === 'number' && !isNaN(idea.upvoteCount)) {
    return idea.upvoteCount
  }
  if (typeof idea.upvotes === 'number' && !isNaN(idea.upvotes)) {
    return idea.upvotes
  }
  return 0
}

function IdeasPage() {
  const { user } = useAuth()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Search, Filter, and Sort State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [sortBy, setSortBy] = useState('newest')

  const fetchIdeas = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getIdeas(user?.uid)
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
        const data = await getIdeas(user?.uid)
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
  }, [user?.uid])

  // Handles state synchronization when an idea's vote is toggled
  const handleVoteChange = (ideaId, { hasUpvoted, upvoteCount }) => {
    setIdeas((prevIdeas) =>
      prevIdeas.map((item) => {
        if (item.id !== ideaId) return item
        const newCount =
          typeof upvoteCount === 'number'
            ? upvoteCount
            : item.upvoteCount !== null
              ? (item.upvoteCount || 0) + (hasUpvoted ? 1 : -1)
              : null
        return {
          ...item,
          hasUpvoted,
          upvoteCount: newCount,
          upvotes: newCount,
        }
      })
    )
  }

  // Reset all search, filter, and sorting controls to defaults
  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedCategory('All')
    setSelectedStatus('All')
    setSortBy('newest')
  }

  const isFiltered =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'All' ||
    selectedStatus !== 'All' ||
    sortBy !== 'newest'

  // Derive filtered and sorted ideas without mutating the original ideas state
  const filteredIdeas = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase()

    const matchingIdeas = ideas.filter((idea) => {
      // 1. Search filter: matches either title or description case-insensitively
      if (trimmedQuery) {
        const titleMatch = (idea.title || '').toLowerCase().includes(trimmedQuery)
        const descMatch = (idea.description || '').toLowerCase().includes(trimmedQuery)
        if (!titleMatch && !descMatch) {
          return false
        }
      }

      // 2. Category filter
      if (selectedCategory !== 'All' && idea.category !== selectedCategory) {
        return false
      }

      // 3. Status filter
      if (selectedStatus !== 'All' && idea.status !== selectedStatus) {
        return false
      }

      return true
    })

    // 4. Local sorting
    return matchingIdeas.sort((a, b) => {
      if (sortBy === 'upvotes') {
        const votesDiff = getIdeaVoteCount(b) - getIdeaVoteCount(a)
        if (votesDiff !== 0) {
          return votesDiff
        }
        // Tie-breaker: newest first
        return getIdeaTimestampValue(b) - getIdeaTimestampValue(a)
      }

      // Default: 'newest'
      const timeDiff = getIdeaTimestampValue(b) - getIdeaTimestampValue(a)
      if (timeDiff !== 0) {
        return timeDiff
      }
      // Tie-breaker: most upvoted
      return getIdeaVoteCount(b) - getIdeaVoteCount(a)
    })
  }, [ideas, searchQuery, selectedCategory, selectedStatus, sortBy])

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
            {/* Search, Filter, and Sorting Controls */}
            <div className="ideas-controls-card" role="search" aria-label="Search and filter proposals">
              {/* Search Bar */}
              <div className="ideas-search-bar">
                <label htmlFor="ideas-search-input" className="ideas-control-label">
                  Search Proposals
                </label>
                <div className="ideas-search-input-wrap">
                  <span className="ideas-search-icon" aria-hidden="true">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    id="ideas-search-input"
                    type="search"
                    className="ideas-search-input"
                    placeholder="Search by title or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search proposals by title or description"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="ideas-clear-search-btn"
                      aria-label="Clear search input"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {/* Filters and Sorting Controls */}
              <div className="ideas-filters-row">
                {/* Category Filter */}
                <div className="ideas-control-group">
                  <label htmlFor="ideas-category-select" className="ideas-control-label">
                    Category
                  </label>
                  <select
                    id="ideas-category-select"
                    className="ideas-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    aria-label="Filter proposals by category"
                  >
                    <option value="All">All Categories</option>
                    {IDEA_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="ideas-control-group">
                  <label htmlFor="ideas-status-select" className="ideas-control-label">
                    Status
                  </label>
                  <select
                    id="ideas-status-select"
                    className="ideas-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    aria-label="Filter proposals by status"
                  >
                    <option value="All">All Statuses</option>
                    {IDEA_STATUSES.map((stat) => (
                      <option key={stat} value={stat}>
                        {stat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sorting Control */}
                <div className="ideas-control-group">
                  <label htmlFor="ideas-sort-select" className="ideas-control-label">
                    Sort By
                  </label>
                  <select
                    id="ideas-sort-select"
                    className="ideas-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="Sort proposals"
                  >
                    <option value="newest">Newest First</option>
                    <option value="upvotes">Most Upvoted</option>
                  </select>
                </div>

                {/* Reset Action */}
                {isFiltered && (
                  <div className="ideas-reset-group">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="btn btn-secondary ideas-reset-btn"
                      aria-label="Reset all search, filter, and sorting controls"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Results Metadata Bar */}
            <div className="ideas-meta-bar">
              <span className="ideas-count-badge">
                {isFiltered ? (
                  <>
                    Showing {filteredIdeas.length} of {ideas.length}{' '}
                    {ideas.length === 1 ? 'proposal' : 'proposals'}
                  </>
                ) : (
                  <>
                    Showing {ideas.length} {ideas.length === 1 ? 'proposal' : 'proposals'}
                  </>
                )}
              </span>

              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="ideas-meta-clear-link"
                  aria-label="Clear all applied filters and search"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Ideas Grid or No Matching Results */}
            {filteredIdeas.length === 0 ? (
              <div className="ideas-no-results-card" role="status" aria-live="polite">
                <div className="ideas-no-results-icon" aria-hidden="true">
                  🔍
                </div>
                <h2 className="ideas-no-results-title">No matching proposals found</h2>
                <p className="ideas-no-results-desc">
                  We couldn't find any proposals matching your current search or filter criteria.
                  Try adjusting your search query, selecting different categories, or resetting all filters.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-primary"
                >
                  Reset Search &amp; Filters
                </button>
              </div>
            ) : (
              <div className="ideas-grid">
                {filteredIdeas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onVoteChange={(voteData) => handleVoteChange(idea.id, voteData)}
                  />
                ))}
              </div>
            )}

            {/* Bottom CTA */}
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
