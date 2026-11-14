import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context'
import { getUserIdeas, IDEA_STATUSES } from '../services/ideasService'
import { filterAndSortIdeas } from '../utils/ideaFilters'
import {
  getUserProfile,
  saveUserProfile,
  validateProfileInput,
  PROFILE_LIMITS,
} from '../services/profileService'
import IdeaCard from '../components/IdeaCard'
import EmptyState from '../components/EmptyState'
import './ProfilePage.css'
import './IdeasPage.css'

function ProfilePage() {
  const { user, loading: authLoading, signInWithGoogle, isConfigured, isModerator } = useAuth()

  // Profile data & loading
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)

  // Edit mode & form state
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    department: '',
    year: '',
  })
  const [formErrors, setFormErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Idea activity state
  const [ideas, setIdeas] = useState([])
  const [ideasLoading, setIdeasLoading] = useState(true)
  const [ideasError, setIdeasError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('default')

  // Guest sign-in state
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signInError, setSignInError] = useState(null)

  const activeUserIdRef = useRef(null)
  const profileRequestIdRef = useRef(0)
  const ideasRequestIdRef = useRef(0)

  // Fetch student profile document from Firestore
  const fetchProfile = useCallback((userId) => {
    if (!userId) return
    const requestId = ++profileRequestIdRef.current

    getUserProfile(userId)
      .then((data) => {
        if (activeUserIdRef.current === userId && profileRequestIdRef.current === requestId) {
          setProfile(data)
          setProfileError(null)
          setProfileLoading(false)
        }
      })
      .catch((err) => {
        if (activeUserIdRef.current === userId && profileRequestIdRef.current === requestId) {
          console.error('Failed to load profile:', err)
          setProfileError(err.message || 'Failed to load your profile details.')
          setProfileLoading(false)
        }
      })
  }, [])

  // Fetch student submitted ideas
  const fetchIdeas = useCallback((userId) => {
    if (!userId) return
    const requestId = ++ideasRequestIdRef.current

    getUserIdeas(userId)
      .then((userIdeas) => {
        if (activeUserIdRef.current === userId && ideasRequestIdRef.current === requestId) {
          setIdeas(userIdeas)
          setIdeasError(null)
          setIdeasLoading(false)
        }
      })
      .catch((err) => {
        if (activeUserIdRef.current === userId && ideasRequestIdRef.current === requestId) {
          console.error('Failed to load user ideas for profile:', err)
          setIdeasError(err.message || 'Failed to load your submitted ideas.')
          setIdeasLoading(false)
        }
      })
  }, [])

  const handleRetryProfile = () => {
    if (!user?.uid) return
    setProfileLoading(true)
    setProfileError(null)
    fetchProfile(user.uid)
  }

  const handleRetryIdeas = () => {
    if (!user?.uid) return
    setIdeasLoading(true)
    setIdeasError(null)
    fetchIdeas(user.uid)
  }

  // Subscribe to authenticated user changes
  useEffect(() => {
    if (authLoading || !user?.uid) {
      activeUserIdRef.current = null
      profileRequestIdRef.current += 1
      ideasRequestIdRef.current += 1
      // eslint-disable-next-line react/set-state-in-effect, react-hooks/set-state-in-effect
      setProfile(null)
      setProfileLoading(false)
      setProfileError(null)
      setIdeas([])
      setIdeasLoading(false)
      setIdeasError(null)
      setStatusFilter('All')
      setSearchQuery('')
      setSortBy('default')
      setIsEditing(false)
      setFormData({
        displayName: '',
        bio: '',
        department: '',
        year: '',
      })
      setFormErrors({})
      setIsSaving(false)
      setSaveSuccess(false)
      setSaveError(null)
      return undefined
    }

    const currentUid = user.uid
    activeUserIdRef.current = currentUid

    // Reset relevant state and set loading flags before fetching data for the new account
    setProfile(null)
    setProfileLoading(true)
    setProfileError(null)
    setIdeas([])
    setIdeasLoading(true)
    setIdeasError(null)
    setStatusFilter('All')
    setSearchQuery('')
    setSortBy('default')
    setIsEditing(false)
    setFormData({
      displayName: '',
      bio: '',
      department: '',
      year: '',
    })
    setFormErrors({})
    setIsSaving(false)
    setSaveSuccess(false)
    setSaveError(null)

    fetchProfile(currentUid)
    fetchIdeas(currentUid)

    return () => {
      activeUserIdRef.current = null
      profileRequestIdRef.current += 1
      ideasRequestIdRef.current += 1
    }
  }, [authLoading, user?.uid, fetchProfile, fetchIdeas])

  // Initialize or reset form data based on current profile & auth user
  const initializeFormData = useCallback(() => {
    setFormData({
      displayName: profile?.displayName || user?.displayName || user?.email?.split('@')[0] || '',
      bio: profile?.bio || '',
      department: profile?.department || '',
      year: profile?.year || '',
    })
    setFormErrors({})
    setSaveError(null)
  }, [profile, user])

  // Enter edit mode
  const handleStartEdit = () => {
    initializeFormData()
    setSaveSuccess(false)
    setIsEditing(true)
  }

  // Cancel edit mode
  const handleCancelEdit = () => {
    initializeFormData()
    setIsEditing(false)
    setSaveError(null)
  }

  // Form input change handler
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Clear validation error for field on change
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: null,
      }))
    }
    setSaveSuccess(false)
  }

  // Save profile changes
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!user?.uid || isSaving) return

    const saveUid = user.uid
    const validation = validateProfileInput(formData)
    if (!validation.isValid) {
      setFormErrors(validation.errors)
      return
    }

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const updated = await saveUserProfile(saveUid, formData, user)
      if (activeUserIdRef.current === saveUid) {
        setProfile((prev) => ({
          ...prev,
          ...updated,
        }))
        setSaveSuccess(true)
        setIsEditing(false)
      }
    } catch (err) {
      if (activeUserIdRef.current === saveUid) {
        console.error('Failed to save profile:', err)
        setSaveError(err.message || 'Failed to save profile changes. Please try again.')
      }
    } finally {
      if (activeUserIdRef.current === saveUid) {
        setIsSaving(false)
      }
    }
  }

  // Guest Google Sign In
  const handleGoogleSignIn = async () => {
    if (isSigningIn) return
    if (!isConfigured) {
      setSignInError('Firebase Authentication is not configured in this environment.')
      return
    }

    setSignInError(null)
    setIsSigningIn(true)

    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('Profile Sign-In failed:', err)
      const code = err?.code || ''
      if (code === 'auth/popup-closed-by-user') {
        setSignInError(null)
      } else if (code === 'auth/unauthorized-domain') {
        setSignInError('This domain is not authorized in Firebase Console.')
      } else if (code === 'auth/network-request-failed') {
        setSignInError('Network error connecting to Firebase. Please check your connection.')
      } else {
        setSignInError(err.message || 'Failed to sign in with Google.')
      }
    } finally {
      setIsSigningIn(false)
    }
  }

  // Derive display values with graceful fallbacks
  const effectiveDisplayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Student'

  const effectiveEmail = user?.email || profile?.email || 'No email associated'

  const userInitials = useMemo(() => {
    if (effectiveDisplayName && effectiveDisplayName.trim()) {
      return effectiveDisplayName
        .trim()
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    }
    if (effectiveEmail) {
      return effectiveEmail[0].toUpperCase()
    }
    return 'U'
  }, [effectiveDisplayName, effectiveEmail])

  // Calculate real activity metrics from real Firestore ideas
  const totalSubmissions = ideas.length
  const underReviewCount = ideas.filter((i) => i.status === 'Under Review').length
  const acceptedOrImplementedCount = ideas.filter(
    (i) => i.status === 'Accepted' || i.status === 'Implemented' || i.status === 'In Progress'
  ).length

  const totalVotesReceived = ideas.reduce((sum, idea) => {
    const count =
      typeof idea.upvoteCount === 'number'
        ? idea.upvoteCount
        : typeof idea.upvotes === 'number'
          ? idea.upvotes
          : 0
    return sum + count
  }, 0)

  // Filter and sort ideas by selected status, search query, and sort option
  const filteredIdeas = useMemo(() => {
    return filterAndSortIdeas(ideas, {
      searchQuery,
      selectedStatus: statusFilter,
      sortBy,
    })
  }, [ideas, searchQuery, statusFilter, sortBy])

  return (
    <div className="page-container profile-page">
      {/* Auth Resolving State */}
      {authLoading ? (
        <div className="ideas-state-card" role="status" aria-live="polite">
          <div className="ideas-loading-spinner" aria-hidden="true" />
          <h2 className="ideas-state-title">Loading Profile...</h2>
          <p className="ideas-state-desc">Verifying your student identity and session.</p>
        </div>
      ) : !user ? (
        /* Guest / Signed-Out State */
        <div className="dashboard-guest-card" role="region" aria-label="Sign-in prompt for guest users">
          <div className="dashboard-guest-icon-badge" aria-hidden="true">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          <h1 className="dashboard-guest-title">Student Profile</h1>
          <p className="dashboard-guest-desc">
            Sign in with your campus Google account to access your student profile, manage your bio, and monitor your submitted proposals.
          </p>

          <div className="dashboard-guest-actions">
            <button
              type="button"
              className="dashboard-google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              aria-label="Sign in with Google"
            >
              <svg
                className="google-svg-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isSigningIn ? 'Signing in...' : 'Sign In with Google'}</span>
            </button>
          </div>

          {signInError && (
            <div className="dashboard-guest-error" role="alert">
              <span className="error-icon" aria-hidden="true">⚠️</span>
              <span>{signInError}</span>
            </div>
          )}
        </div>
      ) : (
        /* Authenticated Student Profile View */
        <>
          {/* Success Banner */}
          {saveSuccess && (
            <div className="profile-alert profile-alert-success" role="status" aria-live="polite">
              <span className="profile-alert-icon" aria-hidden="true">✓</span>
              <span>Profile updated successfully!</span>
              <button
                type="button"
                className="profile-alert-dismiss"
                onClick={() => setSaveSuccess(false)}
                aria-label="Dismiss notice"
              >
                &times;
              </button>
            </div>
          )}

          {/* Profile Error Banner */}
          {profileError && (
            <div className="profile-alert profile-alert-error" role="alert">
              <span className="profile-alert-icon" aria-hidden="true">⚠️</span>
              <span>{profileError}</span>
              <button
                type="button"
                className="profile-btn profile-btn-secondary profile-btn-sm"
                onClick={handleRetryProfile}
              >
                Retry
              </button>
            </div>
          )}

          {/* Profile Identity Card / Editor */}
          {profileLoading ? (
            <div className="ideas-state-card" role="status" aria-live="polite">
              <div className="ideas-loading-spinner" aria-hidden="true" />
              <h2 className="ideas-state-title">Loading Profile Details...</h2>
              <p className="ideas-state-desc">Retrieving your personal student information.</p>
            </div>
          ) : (
            <section className="profile-card" aria-label="Student profile overview">
            <div className="profile-card-header">
              <div className="profile-avatar-container">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={effectiveDisplayName}
                    className="profile-avatar-image"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="profile-avatar-placeholder" aria-hidden="true">
                    {userInitials}
                  </div>
                )}
              </div>

              <div className="profile-identity-info">
                <div className="profile-name-row">
                  <h1 className="profile-display-name">{effectiveDisplayName}</h1>
                  {isModerator && (
                    <span className="profile-badge profile-badge-moderator" title="Campus Moderator">
                      Staff Moderator
                    </span>
                  )}
                  {!isModerator && (
                    <span className="profile-badge profile-badge-student">Student</span>
                  )}
                </div>

                <div className="profile-email-row" title="Identity verified via Firebase Auth">
                  <svg
                    className="profile-email-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span className="profile-email-text">{effectiveEmail}</span>
                  <span className="profile-verified-pill" aria-label="Verified identity">
                    Verified
                  </span>
                </div>

                {/* Academic Chips (Department & Year) */}
                {(profile?.department || profile?.year) && (
                  <div className="profile-academic-chips">
                    {profile.department && (
                      <span className="profile-chip" data-testid="profile-department-chip">
                        🏛️ {profile.department}
                      </span>
                    )}
                    {profile.year && (
                      <span className="profile-chip" data-testid="profile-year-chip">
                        🎓 {profile.year}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="profile-header-actions">
                {!isEditing && (
                  <button
                    type="button"
                    className="btn btn-secondary profile-edit-btn"
                    onClick={handleStartEdit}
                    data-testid="profile-edit-button"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>
            </div>

            {/* Profile Bio Section */}
            {!isEditing && (
              <div className="profile-bio-section">
                <h2 className="profile-section-title">About</h2>
                {profile?.bio ? (
                  <p className="profile-bio-text">{profile.bio}</p>
                ) : (
                  <p className="profile-bio-placeholder">
                    No biography provided yet. Click &quot;Edit Profile&quot; to add your academic interests or department!
                  </p>
                )}
              </div>
            )}

            {/* Edit Profile Form */}
            {isEditing && (
              <form
                className="profile-edit-form"
                onSubmit={handleSaveProfile}
                aria-label="Edit Profile Form"
              >
                <div className="profile-form-header">
                  <h2 className="profile-form-title">Edit Student Profile</h2>
                  <p className="profile-form-desc">
                    Update your public display information. Account email is locked to your authenticated campus credentials.
                  </p>
                </div>

                {saveError && (
                  <div className="profile-form-error" role="alert">
                    <span>⚠️ {saveError}</span>
                  </div>
                )}

                <div className="profile-form-grid">
                  {/* Display Name Field */}
                  <div className="profile-field-group">
                    <label htmlFor="profile-displayName" className="profile-field-label">
                      Display Name <span className="profile-required-mark">*</span>
                    </label>
                    <input
                      id="profile-displayName"
                      name="displayName"
                      type="text"
                      className={`profile-input ${formErrors.displayName ? 'has-error' : ''}`}
                      value={formData.displayName}
                      onChange={handleInputChange}
                      maxLength={PROFILE_LIMITS.DISPLAY_NAME_MAX}
                      required
                      disabled={isSaving}
                      placeholder="e.g. Alex Morgan"
                      aria-describedby={formErrors.displayName ? 'error-displayName' : undefined}
                    />
                    {formErrors.displayName && (
                      <span id="error-displayName" className="profile-field-error" role="alert">
                        {formErrors.displayName}
                      </span>
                    )}
                  </div>

                  {/* Read-only Email Field */}
                  <div className="profile-field-group">
                    <label htmlFor="profile-email" className="profile-field-label">
                      Campus Email <span className="profile-readonly-badge">(Read-only)</span>
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      className="profile-input is-readonly"
                      value={effectiveEmail}
                      disabled
                      readOnly
                      title="Managed securely by Firebase Auth"
                    />
                    <span className="profile-field-hint">
                      Identity email is managed directly by Firebase Authentication.
                    </span>
                  </div>

                  {/* Department Field */}
                  <div className="profile-field-group">
                    <label htmlFor="profile-department" className="profile-field-label">
                      Academic Department / Major <span className="profile-optional-badge">(Optional)</span>
                    </label>
                    <input
                      id="profile-department"
                      name="department"
                      type="text"
                      className={`profile-input ${formErrors.department ? 'has-error' : ''}`}
                      value={formData.department}
                      onChange={handleInputChange}
                      maxLength={PROFILE_LIMITS.DEPARTMENT_MAX}
                      disabled={isSaving}
                      placeholder="e.g. Computer Science, Architecture, Business"
                      aria-describedby={formErrors.department ? 'error-department' : undefined}
                    />
                    {formErrors.department && (
                      <span id="error-department" className="profile-field-error" role="alert">
                        {formErrors.department}
                      </span>
                    )}
                  </div>

                  {/* Academic Year Field */}
                  <div className="profile-field-group">
                    <label htmlFor="profile-year" className="profile-field-label">
                      Academic Year / Class <span className="profile-optional-badge">(Optional)</span>
                    </label>
                    <input
                      id="profile-year"
                      name="year"
                      type="text"
                      className={`profile-input ${formErrors.year ? 'has-error' : ''}`}
                      value={formData.year}
                      onChange={handleInputChange}
                      maxLength={PROFILE_LIMITS.YEAR_MAX}
                      disabled={isSaving}
                      placeholder="e.g. Sophomore, Class of 2027"
                      aria-describedby={formErrors.year ? 'error-year' : undefined}
                    />
                    {formErrors.year && (
                      <span id="error-year" className="profile-field-error" role="alert">
                        {formErrors.year}
                      </span>
                    )}
                  </div>

                  {/* Biography Field */}
                  <div className="profile-field-group full-width">
                    <div className="profile-field-header-row">
                      <label htmlFor="profile-bio" className="profile-field-label">
                        Biography <span className="profile-optional-badge">(Optional)</span>
                      </label>
                      <span className="profile-char-counter">
                        {formData.bio.length} / {PROFILE_LIMITS.BIO_MAX}
                      </span>
                    </div>
                    <textarea
                      id="profile-bio"
                      name="bio"
                      className={`profile-textarea ${formErrors.bio ? 'has-error' : ''}`}
                      value={formData.bio}
                      onChange={handleInputChange}
                      maxLength={PROFILE_LIMITS.BIO_MAX}
                      rows={3}
                      disabled={isSaving}
                      placeholder="Share a brief introduction about yourself and the campus initiatives you care about..."
                      aria-describedby={formErrors.bio ? 'error-bio' : undefined}
                    />
                    {formErrors.bio && (
                      <span id="error-bio" className="profile-field-error" role="alert">
                        {formErrors.bio}
                      </span>
                    )}
                  </div>
                </div>

                <div className="profile-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving}
                    data-testid="profile-save-button"
                  >
                    {isSaving ? 'Saving Changes...' : 'Save Profile'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
          )}

          {/* Activity Summary Cards */}
          <section className="profile-activity-summary" aria-label="Student proposal metrics">
            <h2 className="profile-section-heading">Proposal Activity Summary</h2>
            <div className="profile-stats-grid">
              <div className="profile-stat-card">
                <span className="profile-stat-number">{totalSubmissions}</span>
                <span className="profile-stat-label">Submitted Ideas</span>
              </div>
              <div className="profile-stat-card">
                <span className="profile-stat-number">{underReviewCount}</span>
                <span className="profile-stat-label">Under Review</span>
              </div>
              <div className="profile-stat-card">
                <span className="profile-stat-number">{acceptedOrImplementedCount}</span>
                <span className="profile-stat-label">Accepted / In Progress</span>
              </div>
              <div className="profile-stat-card">
                <span className="profile-stat-number">{totalVotesReceived}</span>
                <span className="profile-stat-label">Community Upvotes</span>
              </div>
            </div>
          </section>

          {/* Student Idea Activity Section */}
          <section className="profile-ideas-section" aria-label="Submitted ideas activity">
            <div className="profile-ideas-header">
              <div>
                <h2 className="profile-section-heading">Your Ideas & Contributions</h2>
                <p className="profile-section-subheading">
                  Browse and track all campus proposals authored by your account.
                </p>
              </div>
              <Link to="/submit" className="btn btn-primary profile-submit-link">
                + Submit an Idea
              </Link>
            </div>

            {/* Search and Sort Toolbar */}
            {ideas.length > 0 && (
              <div className="profile-search-sort-bar">
                <div className="profile-search-wrap">
                  <span className="profile-search-icon" aria-hidden="true">🔍</span>
                  <input
                    type="search"
                    className="profile-search-input"
                    placeholder="Search your proposals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search your submitted proposals"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="profile-search-clear-btn"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search query"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="profile-sort-wrap">
                  <label htmlFor="profile-sort-select" className="profile-sort-label">
                    Sort:
                  </label>
                  <select
                    id="profile-sort-select"
                    className="profile-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="Sort your submitted proposals"
                  >
                    <option value="default">Default</option>
                    <option value="newest">Newest First</option>
                    <option value="upvotes">Most Upvoted</option>
                  </select>
                </div>
              </div>
            )}

            {/* Status Filter Tabs */}
            <div className="profile-filter-bar" role="tablist" aria-label="Filter ideas by status">
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'All'}
                className={`profile-filter-pill ${statusFilter === 'All' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('All')}
              >
                All ({ideas.length})
              </button>
              {IDEA_STATUSES.map((statusName) => {
                const count = ideas.filter((i) => i.status === statusName).length
                if (count === 0 && statusFilter !== statusName) {
                  return null
                }
                return (
                  <button
                    key={statusName}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === statusName}
                    className={`profile-filter-pill ${statusFilter === statusName ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter(statusName)}
                  >
                    {statusName} ({count})
                  </button>
                )
              })}
            </div>

            {/* Idea Activity List / States */}
            {ideasLoading ? (
              <div className="ideas-state-card" role="status" aria-live="polite">
                <div className="ideas-loading-spinner" aria-hidden="true" />
                <h3 className="ideas-state-title">Loading your ideas...</h3>
                <p className="ideas-state-desc">Fetching your authored proposals from Firestore.</p>
              </div>
            ) : ideasError ? (
              <div className="ideas-state-card" role="alert">
                <div className="ideas-state-icon" aria-hidden="true">⚠️</div>
                <h3 className="ideas-state-title">Failed to load ideas</h3>
                <p className="ideas-state-desc">{ideasError}</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRetryIdeas}
                >
                  Retry
                </button>
              </div>
            ) : filteredIdeas.length === 0 ? (
              <EmptyState
                title={
                  ideas.length === 0
                    ? 'No Ideas Submitted Yet'
                    : searchQuery
                      ? 'No Matching Ideas'
                      : `No "${statusFilter}" Ideas`
                }
                description={
                  ideas.length === 0
                    ? "You haven't posted any campus improvement ideas yet. Propose your first idea to rally community support!"
                    : searchQuery
                      ? `No submitted proposals match "${searchQuery}".`
                      : `You have no submitted proposals currently in the "${statusFilter}" status.`
                }
                actionText={
                  ideas.length === 0
                    ? 'Submit an Idea'
                    : searchQuery
                      ? 'Clear Search'
                      : 'Clear Filter'
                }
                actionLink={ideas.length === 0 ? '/submit' : undefined}
                onClick={
                  ideas.length === 0
                    ? undefined
                    : searchQuery
                      ? () => setSearchQuery('')
                      : () => setStatusFilter('All')
                }
              />
            ) : (
              <div className="profile-ideas-grid" data-testid="profile-ideas-grid">
                {filteredIdeas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default ProfilePage
