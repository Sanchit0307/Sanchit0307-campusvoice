import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context'
import { getIdeas } from '../services/ideasService'
import IdeaCard from '../components/IdeaCard'
import './HomePage.css'

function HomePage() {
  const { user } = useAuth()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
          console.error('Failed to load campus proposals for homepage:', err)
          setError(err.message || 'Unable to load live campus proposals.')
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

  // Derive real application statistics directly from Firestore data
  const totalProposals = ideas.length
  const totalUpvotes = ideas.reduce((sum, item) => {
    const votes =
      typeof item.upvoteCount === 'number'
        ? item.upvoteCount
        : typeof item.upvotes === 'number'
          ? item.upvotes
          : 0
    return sum + votes
  }, 0)
  const implementedCount = ideas.filter(
    (i) => i.status === 'Implemented' || i.status === 'Accepted'
  ).length
  const activeCategoriesCount = new Set(
    ideas.map((i) => i.category).filter(Boolean)
  ).size

  // Recent ideas for the Explore section (up to 4 real proposals)
  const featuredIdeas = ideas.slice(0, 4)

  const scrollToHowItWorks = (e) => {
    e.preventDefault()
    const target = document.getElementById('how-it-works')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="home-container">
      {/* 1. Hero Section — Editorial Split */}
      <section className="home-hero-section" aria-labelledby="hero-headline">
        <div className="home-hero-content">
          <span className="home-hero-tag">TechSpace BuildLab &bull; Campus Governance</span>

          <h1 id="hero-headline" className="home-hero-title">
            A Platform for Student Ideas, Campus Improvement and Collective Action.
          </h1>

          <p className="home-hero-desc">
            CampusVoice connects students directly with campus leadership. Propose constructive solutions,
            rally peer support through transparent upvoting, and track initiatives as they move from student
            submission to real-world campus implementation.
          </p>

          <div className="home-hero-actions">
            <Link to="/submit" className="btn btn-primary btn-lg">
              Submit an Idea
            </Link>
            <a href="#how-it-works" onClick={scrollToHowItWorks} className="btn btn-secondary btn-lg">
              How It Works
            </a>
          </div>
        </div>

        {/* Hero Right: University Governance Activity Brief */}
        <div className="home-hero-visual" aria-hidden="true">
          <div className="civic-brief-panel">
            <div className="civic-brief-header">
              <div className="civic-brief-title-group">
                <span className="civic-brief-title">Campus Governance Brief</span>
                <span className="civic-brief-subtitle">Active Student Session</span>
              </div>
              <span className="civic-status-indicator">
                <span className="civic-status-dot" />
                Live Feed
              </span>
            </div>

            <div className="civic-brief-body">
              <div className="civic-activity-row">
                <div className="civic-activity-meta">
                  <span className="civic-category-tag">Facilities &amp; Infrastructure</span>
                  <span className="civic-stage-pill stage-review">Under Review</span>
                </div>
                <span className="civic-activity-title">Solar Powered Benches on North Quad</span>
              </div>

              <div className="civic-activity-row">
                <div className="civic-activity-meta">
                  <span className="civic-category-tag">Academics &amp; Study</span>
                  <span className="civic-stage-pill stage-done">Implemented</span>
                </div>
                <span className="civic-activity-title">24/7 Library Study Rooms During Finals</span>
              </div>

              <div className="civic-activity-row">
                <div className="civic-activity-meta">
                  <span className="civic-category-tag">Campus Dining</span>
                  <span className="civic-stage-pill stage-accepted">Accepted</span>
                </div>
                <span className="civic-activity-title">Expanded Healthy Dining &amp; Allergen Labeling</span>
              </div>
            </div>

            <div className="civic-brief-footer">
              <span>Direct Link to Administration</span>
              <span className="civic-brief-footer-highlight">Verified Consensus</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Platform Trust & Metrics */}
      <section className="home-stats-section" aria-label="Platform Statistics and Governance Indicators">
        <div className="home-trust-statement">
          <span className="trust-statement-label">Campus Accountability Standards</span>
          <div className="trust-badges-inline">
            <span className="trust-badge-item">
              <span className="trust-badge-icon" aria-hidden="true">✓</span>
              Verified Student Authentication
            </span>
            <span className="trust-badge-item">
              <span className="trust-badge-icon" aria-hidden="true">✓</span>
              Immutable Lifecycle Audit Trail
            </span>
            <span className="trust-badge-item">
              <span className="trust-badge-icon" aria-hidden="true">✓</span>
              Formal Administrative Review
            </span>
          </div>
        </div>

        {/* Real Dynamic Application Metrics */}
        <div className="civic-metrics-strip">
          <div className="civic-metric-cell">
            <span className="civic-metric-value">{loading ? '—' : totalProposals}</span>
            <span className="civic-metric-name">Total Student Proposals</span>
            <span className="civic-metric-caption">Submitted across all campus departments</span>
          </div>

          <div className="civic-metric-cell">
            <span className="civic-metric-value">{loading ? '—' : totalUpvotes}</span>
            <span className="civic-metric-name">Verified Community Upvotes</span>
            <span className="civic-metric-caption">Peer votes prioritizing campus initiatives</span>
          </div>

          <div className="civic-metric-cell">
            <span className="civic-metric-value">{loading ? '—' : implementedCount}</span>
            <span className="civic-metric-name">Formally Adopted</span>
            <span className="civic-metric-caption">Proposals accepted or actively implemented</span>
          </div>

          <div className="civic-metric-cell">
            <span className="civic-metric-value">{loading ? '—' : (activeCategoriesCount || 0)}</span>
            <span className="civic-metric-name">Active Focus Areas</span>
            <span className="civic-metric-caption">Covering Facilities, Dining, Academics &amp; Life</span>
          </div>
        </div>
      </section>

      {/* 3. How CampusVoice Works (Sequential Pipeline) */}
      <section id="how-it-works" className="home-how-section" aria-labelledby="how-it-works-title">
        <div className="home-section-header-editorial">
          <span className="home-section-tag">Governance Workflow</span>
          <h2 id="how-it-works-title" className="home-section-title">
            How CampusVoice Works
          </h2>
          <p className="home-section-desc">
            A structured, transparent lifecycle ensures that every student proposal receives visibility,
            community backing, and formal administrative evaluation.
          </p>
        </div>

        <div className="civic-pipeline-grid">
          <div className="civic-pipeline-step">
            <div className="pipeline-step-header">
              <span className="pipeline-step-num">Stage 01</span>
              <span className="pipeline-step-stage-name">Submission</span>
            </div>
            <h3 className="pipeline-step-title">Propose &amp; Categorize</h3>
            <p className="pipeline-step-desc">
              Draft an actionable proposal with title and description. Assisted categorization tags your idea to the proper campus committee.
            </p>
          </div>

          <div className="civic-pipeline-step">
            <div className="pipeline-step-header">
              <span className="pipeline-step-num">Stage 02</span>
              <span className="pipeline-step-stage-name">Consensus</span>
            </div>
            <h3 className="pipeline-step-title">Rally Community Support</h3>
            <p className="pipeline-step-desc">
              Students discover proposals in the open feed and cast upvotes. Transparent vote metrics demonstrate clear community demand.
            </p>
          </div>

          <div className="civic-pipeline-step">
            <div className="pipeline-step-header">
              <span className="pipeline-step-num">Stage 03</span>
              <span className="pipeline-step-stage-name">Evaluation</span>
            </div>
            <h3 className="pipeline-step-title">Administrative Review</h3>
            <p className="pipeline-step-desc">
              Campus staff evaluate feasibility, budget, and impact, transitioning vetted initiatives to Under Review or Accepted.
            </p>
          </div>

          <div className="civic-pipeline-step">
            <div className="pipeline-step-header">
              <span className="pipeline-step-num">Stage 04</span>
              <span className="pipeline-step-stage-name">Action</span>
            </div>
            <h3 className="pipeline-step-title">Implementation</h3>
            <p className="pipeline-step-desc">
              Approved initiatives move to In Progress and Implemented. Authors receive real-time notifications at each milestone.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Explore Campus Ideas (Live Database Proposals) */}
      <section className="home-explore-section" aria-labelledby="explore-heading">
        <div className="home-explore-header">
          <div className="home-explore-header-left">
            <span className="home-section-tag">Active Feed</span>
            <h2 id="explore-heading" className="home-section-title">
              Explore Campus Ideas
            </h2>
          </div>
          <Link to="/ideas" className="home-explore-view-all">
            <span>View All Proposals ({totalProposals}) &rarr;</span>
          </Link>
        </div>

        {loading ? (
          <div className="home-ideas-loading" role="status" aria-live="polite">
            <div className="home-loading-spinner" aria-hidden="true" />
            <p>Loading campus proposals from database...</p>
          </div>
        ) : error ? (
          <div className="home-ideas-empty">
            <h3 className="home-empty-title">Database Notice</h3>
            <p className="home-empty-desc">{error}</p>
            <Link to="/ideas" className="btn btn-secondary">
              Open Ideas Feed
            </Link>
          </div>
        ) : featuredIdeas.length === 0 ? (
          <div className="home-ideas-empty">
            <h3 className="home-empty-title">No Campus Ideas Yet</h3>
            <p className="home-empty-desc">
              Be the first student to suggest a proposal for facilities, dining, academics, or campus life.
            </p>
            <Link to="/submit" className="btn btn-primary">
              Submit the First Idea
            </Link>
          </div>
        ) : (
          <div className="home-ideas-grid">
            {featuredIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onVoteChange={(voteData) => handleVoteChange(idea.id, voteData)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. Bottom Civic Action Section */}
      <section className="home-cta-banner" aria-label="Submit an Idea Banner">
        <div className="home-cta-text">
          <h2 className="home-cta-title">Ready to improve campus life?</h2>
          <p className="home-cta-desc">
            Every meaningful campus enhancement began as a student suggestion. Propose your idea today and inspire collective action.
          </p>
        </div>
        <div className="home-cta-actions">
          <Link to="/submit" className="btn btn-primary btn-lg">
            Submit an Idea
          </Link>
          <Link to="/ideas" className="btn btn-secondary btn-lg">
            Browse All Ideas
          </Link>
        </div>
      </section>
    </div>
  )
}

export default HomePage
