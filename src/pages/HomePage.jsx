import { Link } from 'react-router-dom'

function HomePage() {
  const lifecycleStages = [
    { name: 'Submitted', desc: 'Students post campus ideas' },
    { name: 'Under Review', desc: 'Moderators review viability' },
    { name: 'Accepted', desc: 'Approved for consideration' },
    { name: 'In Progress', desc: 'Campus team acts on it' },
    { name: 'Implemented', desc: 'Completed campus change' },
  ]

  return (
    <div className="page-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="badge">CampusVoice Home &bull; Issue #2 Shell</div>
        <h1 className="page-title">Shape Your Campus Experience</h1>
        <p className="hero-lead">
          CampusVoice is the central platform for students to propose, discover, and upvote
          ideas that make our campus a better place for everyone.
        </p>

        <div className="hero-cta-group">
          <Link to="/ideas" className="btn btn-primary">
            Browse Ideas
          </Link>
          <Link to="/submit" className="btn btn-secondary">
            Submit an Idea
          </Link>
        </div>
      </section>

      {/* Idea Lifecycle Overview */}
      <section className="shell-card">
        <div className="card-header">
          <h2 className="section-title">Planned Idea Lifecycle</h2>
          <span className="info-tag">Upcoming Workflow</span>
        </div>
        <p className="card-description">
          Ideas follow a structured progression from submission to completion:
        </p>

        <div className="lifecycle-track">
          {lifecycleStages.map((stage, idx) => (
            <div key={stage.name} className="lifecycle-step">
              <div className="step-index">{idx + 1}</div>
              <div className="step-content">
                <span className="step-name">{stage.name}</span>
                <span className="step-desc">{stage.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Access Grid */}
      <section className="features-preview-grid">
        <div className="feature-card">
          <div className="feature-card-icon">💡</div>
          <h3 className="feature-card-title">Browse &amp; Upvote</h3>
          <p className="feature-card-desc">
            Explore ideas submitted by peers, filter by campus category, and upvote the proposals you support.
          </p>
          <Link to="/ideas" className="card-link">Go to Ideas &rarr;</Link>
        </div>

        <div className="feature-card">
          <div className="feature-card-icon">✍️</div>
          <h3 className="feature-card-title">Submit Proposals</h3>
          <p className="feature-card-desc">
            Have a suggestion for dining, facilities, academics, or events? Share it directly with the campus.
          </p>
          <Link to="/submit" className="card-link">Go to Submit &rarr;</Link>
        </div>

        <div className="feature-card">
          <div className="feature-card-icon">📊</div>
          <h3 className="feature-card-title">Track Status</h3>
          <p className="feature-card-desc">
            Monitor the progress of your submissions and review real-time feedback and updates from campus moderators.
          </p>
          <Link to="/dashboard" className="card-link">Go to Dashboard &rarr;</Link>
        </div>
      </section>
    </div>
  )
}

export default HomePage
