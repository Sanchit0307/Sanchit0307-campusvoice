import { Link } from 'react-router-dom'
import { useOnboarding } from '../context'
import './Footer.css'

function Footer() {
  const { startTour } = useOnboarding()

  return (
    <footer className="footer-shell">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand-section">
            <div className="footer-brand">
              <span className="footer-logo">CampusVoice</span>
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
              <li>
                <button
                  type="button"
                  className="footer-tour-btn"
                  onClick={() => startTour(true)}
                  aria-label="Start Quick Tour"
                >
                  Quick Tour
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">
            &copy; 2026 CampusVoice
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
