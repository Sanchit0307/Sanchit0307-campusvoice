import './App.css'

function App() {
  return (
    <div className="app-container">
      <main className="setup-hero">
        <div className="badge">TechSpace BuildLab &apos;26 &bull; Solo Track</div>
        <h1 className="project-title">CampusVoice</h1>
        <p className="project-subtitle">Student Ideas &amp; Suggestions Portal</p>

        <section className="status-card">
          <div className="status-header">
            <span className="status-dot"></span>
            <span className="status-text">Issue #1: Project Setup &amp; Architecture</span>
          </div>
          <p className="status-desc">
            The React application foundation has been initialized with Vite. The environment is verified,
            the folder structure is set up, and the codebase is ready for feature development.
          </p>

          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Environment</span>
              <span className="info-value">React 19 + Vite</span>
            </div>
            <div className="info-item">
              <span className="info-label">Current Branch</span>
              <span className="info-value"><code>feature/project-setup</code></span>
            </div>
            <div className="info-item">
              <span className="info-label">Next Milestone</span>
              <span className="info-value">#2 Application Shell &amp; Navigation</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="setup-footer">
        <p>CampusVoice &bull; Built with React &bull; TechSpace BuildLab &apos;26</p>
      </footer>
    </div>
  )
}

export default App
