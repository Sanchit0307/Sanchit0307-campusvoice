import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  return (
    <footer className="footer-shell">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand-section">
            <div className="footer-brand">
              <span className="footer-logo">CampusVoice</span>
              <span className="footer-badge">Solo Track</span>
            </div>
            <p className="footer-tagline">
              Empowering students to share ideas, foster improvements, and drive positive changes on campus.
            </p>
          </div>

          <div className="footer-links-group">
            <span className="footer-group-title">Navigation</span>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/ideas">Browse Ideas</Link></li>
              <li><Link to="/submit">Submit an Idea</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
            </ul>
          </div>

          <div className="footer-links-group">
            <span className="footer-group-title">Project Info</span>
            <ul className="footer-links">
              <li><span>TechSpace BuildLab &apos;26</span></li>
              <li><span>Milestone: Issue #2 Shell</span></li>
              <li><span>React 19 &bull; Vite</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">
            &copy; 2026 CampusVoice &bull; Built for TechSpace BuildLab &apos;26
          </p>
          <span className="footer-status-pill">
            <span className="status-indicator"></span>
            App Shell &amp; Navigation Active
          </span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
