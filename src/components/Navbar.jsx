import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand Logo & Name */}
        <Link to="/" className="navbar-brand" onClick={closeMobileMenu}>
          <div className="brand-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </div>
          <span className="brand-name">CampusVoice</span>
          <span className="brand-tag">BuildLab &apos;26</span>
        </Link>

        {/* Mobile Menu Hamburger Button */}
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileMenuOpen}
        >
          <span className={`hamburger-bar ${isMobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-bar ${isMobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-bar ${isMobileMenuOpen ? 'open' : ''}`}></span>
        </button>

        {/* Navigation Links */}
        <nav
          className={`navbar-nav ${isMobileMenuOpen ? 'nav-open' : ''}`}
          aria-label="Main Navigation"
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={closeMobileMenu}
          >
            Home
          </NavLink>
          <NavLink
            to="/ideas"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={closeMobileMenu}
          >
            Ideas
          </NavLink>
          <NavLink
            to="/submit"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={closeMobileMenu}
          >
            Submit Idea
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={closeMobileMenu}
          >
            Dashboard
          </NavLink>

          <div className="navbar-actions">
            <Link
              to="/submit"
              className="navbar-cta-btn"
              onClick={closeMobileMenu}
            >
              <span className="cta-icon" aria-hidden="true">+</span>
              New Idea
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}

export default Navbar
