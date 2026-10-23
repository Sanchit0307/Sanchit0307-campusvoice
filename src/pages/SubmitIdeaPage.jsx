import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { IDEA_CATEGORIES } from '../data/mockIdeas'
import { createIdea } from '../services/ideasService'
import { suggestCategory } from '../services/aiService'
import { useAuth } from '../context'
import {
  validateIdeaSubmission,
  getCounterClass,
  TITLE_MAX_LENGTH,
  DESC_MAX_LENGTH,
} from '../utils/validation'
import IdeaCard from '../components/IdeaCard'
import './SubmitIdeaPage.css'

function SubmitIdeaPage() {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
  })

  const [errors, setErrors] = useState({})
  const [submittedIdea, setSubmittedIdea] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // AI Suggestion state
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [aiError, setAiError] = useState(null)
  const requestIdRef = useRef(0)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const canSuggest =
    formData.title.trim().length >= 3 &&
    formData.description.trim().length >= 10 &&
    !isSuggesting

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    if (submitError) {
      setSubmitError(null)
    }

    // Clear field-specific error as the user types
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const validate = () => validateIdeaSubmission(formData, IDEA_CATEGORIES)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isSubmitting) {
      return
    }

    setSubmitError(null)

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)

      // Automatically focus first invalid element for accessibility
      const firstErrorKey = Object.keys(validationErrors)[0]
      const element = document.getElementById(`idea-${firstErrorKey}`)
      if (element) {
        element.focus()
      }
      return
    }

    try {
      setIsSubmitting(true)
      const newIdea = await createIdea({
        title: formData.title.trim(),
        category: formData.category,
        description: formData.description.trim(),
        authorId: user?.uid ?? null,
        authorName: user?.displayName || 'Anonymous Student',
      })

      setSubmittedIdea(newIdea)
      setIsSuccess(true)
    } catch (err) {
      console.error('Failed to submit proposal to Firestore:', err)
      setSubmitError(err.message || 'Failed to submit proposal. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuggestCategory = async () => {
    if (isSuggesting) return

    const trimmedTitle = formData.title.trim()
    const trimmedDesc = formData.description.trim()

    if (trimmedTitle.length < 3 || trimmedDesc.length < 10) {
      setAiError('Please enter a title (3+ chars) and description (10+ chars) before requesting an AI suggestion.')
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const currentReqId = ++requestIdRef.current
    setIsSuggesting(true)
    setAiError(null)

    try {
      const result = await suggestCategory({
        title: trimmedTitle,
        description: trimmedDesc,
        signal: controller.signal,
      })

      // Stale response guard: ensure request sequence and current form content still match
      if (currentReqId === requestIdRef.current) {
        setFormData((prev) => {
          if (
            prev.title.trim() === trimmedTitle &&
            prev.description.trim() === trimmedDesc
          ) {
            setAiSuggestion(result)
            if (IDEA_CATEGORIES.includes(result.category)) {
              setErrors((errs) => {
                const next = { ...errs }
                delete next.category
                return next
              })
              return {
                ...prev,
                category: result.category,
              }
            }
          }
          return prev
        })
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return
      }
      if (currentReqId === requestIdRef.current) {
        setAiError(err.message || 'Unable to suggest a category at this time.')
      }
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsSuggesting(false)
      }
    }
  }

  const handleResetForm = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setFormData({
      title: '',
      category: '',
      description: '',
    })
    setErrors({})
    setSubmittedIdea(null)
    setIsSuccess(false)
    setIsSubmitting(false)
    setSubmitError(null)
    setIsSuggesting(false)
    setAiSuggestion(null)
    setAiError(null)
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Submit a Campus Idea</h1>
        <p className="page-subtitle">
          Propose an enhancement or new initiative to improve academic life, student facilities, or campus culture.
        </p>
      </div>

      {isSuccess && submittedIdea ? (
        /* Success State */
        <div className="submission-success-card" role="status" aria-live="polite">
          <div className="success-banner">
            <div className="success-icon-badge" aria-hidden="true">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h2 className="success-title">Idea Submitted Successfully!</h2>
              <p className="success-description">
                Your proposal has been submitted to CampusVoice and added to the campus ideas feed under the
                <strong> Submitted</strong> stage. Fellow students can now view and support your proposal.
              </p>
            </div>
          </div>

          <div className="submission-preview-section">
            <h3 className="preview-heading">Proposal Preview</h3>
            <div className="preview-card-wrapper">
              <IdeaCard idea={submittedIdea} />
            </div>
          </div>

          <div className="success-actions">
            <Link to="/ideas" className="btn btn-primary">
              View in Ideas Feed &rarr;
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetForm}
            >
              + Submit Another Idea
            </button>
          </div>
        </div>
      ) : (
        /* Form & Guidelines Layout */
        <div className="submit-page-layout">
          <div className="submit-form-card">
            <div className="form-intro">
              <h2 className="form-intro-title">Share Your Suggestion</h2>
              <p className="form-intro-desc">
                Fill in the details below. All fields marked with an asterisk (<span className="required-star">*</span>) are required.
              </p>
            </div>

            {submitError && (
              <div className="form-summary-alert" role="alert">
                <span className="form-alert-icon" aria-hidden="true">⚠️</span>
                <span>{submitError}</span>
              </div>
            )}

            {Object.keys(errors).length > 0 && !submitError && (
              <div className="form-summary-alert" role="alert">
                <span className="form-alert-icon" aria-hidden="true">⚠️</span>
                <span>Please fix the highlighted fields before submitting your proposal.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="submit-idea-form">
              {/* Title Field */}
              <div className="form-group">
                <label htmlFor="idea-title" className="form-label">
                  Idea Title <span className="required-star" aria-hidden="true">*</span>
                </label>
                <p className="form-hint" id="title-hint">
                  A concise, descriptive summary of what you are proposing.
                </p>
                <input
                  type="text"
                  id="idea-title"
                  name="title"
                  className={`form-input ${errors.title ? 'input-error' : ''}`}
                  placeholder="e.g. 24/7 Quiet Study Wing in Main Library during Exam Weeks"
                  value={formData.title}
                  onChange={handleChange}
                  maxLength={TITLE_MAX_LENGTH}
                  aria-required="true"
                  aria-invalid={!!errors.title}
                  aria-describedby={`title-hint ${errors.title ? 'title-error' : ''}`}
                />
                <div className="form-field-meta">
                  {errors.title ? (
                    <p id="title-error" className="form-error-msg" role="alert">
                      <span aria-hidden="true">&bull;</span> {errors.title}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span
                    className={`char-counter ${getCounterClass(formData.title.length, TITLE_MAX_LENGTH)}`}
                    aria-label={`${formData.title.length} of ${TITLE_MAX_LENGTH} characters`}
                  >
                    {formData.title.length} / {TITLE_MAX_LENGTH}
                  </span>
                </div>
              </div>

              {/* Category Field */}
              <div className="form-group">
                <div className="category-header-row">
                  <label htmlFor="idea-category" className="form-label">
                    Category <span className="required-star" aria-hidden="true">*</span>
                  </label>
                  <button
                    type="button"
                    id="suggest-category-btn"
                    className="btn-suggest-category"
                    onClick={handleSuggestCategory}
                    disabled={!canSuggest}
                    aria-busy={isSuggesting}
                    title={
                      canSuggest
                        ? 'Suggest category using Gemini AI'
                        : 'Enter at least 3 characters for title and 10 characters for description to enable AI suggestion'
                    }
                  >
                    {isSuggesting ? (
                      <>
                        <span className="ai-spinner" aria-hidden="true" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <span className="ai-sparkle-icon" aria-hidden="true">✨</span>
                        <span>Suggest Category</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="form-hint" id="category-hint">
                  Choose the campus area your proposal directly impacts.
                </p>

                {aiSuggestion && (
                  <div className="ai-suggestion-badge" role="status" aria-live="polite">
                    <div className="ai-suggestion-top">
                      <span className="ai-sparkle-icon" aria-hidden="true">✨</span>
                      <span className="ai-suggestion-title">
                        AI Suggestion: <strong>{aiSuggestion.category}</strong>
                      </span>
                      {aiSuggestion.confidence && (
                        <span className="ai-confidence-pill">
                          {Math.round(aiSuggestion.confidence * 100)}% match
                        </span>
                      )}
                      {formData.category !== aiSuggestion.category && (
                        <span className="ai-overridden-pill">Manually Changed</span>
                      )}
                    </div>
                    {aiSuggestion.reasoning && (
                      <p className="ai-reasoning-desc">{aiSuggestion.reasoning}</p>
                    )}
                  </div>
                )}

                {aiError && (
                  <div className="ai-error-alert" role="alert">
                    <span className="ai-error-icon" aria-hidden="true">⚠️</span>
                    <span className="ai-error-text">{aiError}</span>
                    <button
                      type="button"
                      className="ai-error-close-btn"
                      onClick={() => setAiError(null)}
                      aria-label="Dismiss error notice"
                    >
                      &times;
                    </button>
                  </div>
                )}

                <div className="select-wrapper">
                  <select
                    id="idea-category"
                    name="category"
                    className={`form-select ${errors.category ? 'input-error' : ''}`}
                    value={formData.category}
                    onChange={handleChange}
                    aria-required="true"
                    aria-invalid={!!errors.category}
                    aria-describedby={`category-hint ${errors.category ? 'category-error' : ''}`}
                  >
                    <option value="">Select a category...</option>
                    {IDEA_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field-meta">
                  {errors.category && (
                    <p id="category-error" className="form-error-msg" role="alert">
                      <span aria-hidden="true">&bull;</span> {errors.category}
                    </p>
                  )}
                </div>
              </div>

              {/* Description Field */}
              <div className="form-group">
                <label htmlFor="idea-description" className="form-label">
                  Description <span className="required-star" aria-hidden="true">*</span>
                </label>
                <p className="form-hint" id="desc-hint">
                  Explain the problem, your proposed solution, and how it benefits students or faculty.
                </p>
                <textarea
                  id="idea-description"
                  name="description"
                  rows={5}
                  className={`form-textarea ${errors.description ? 'input-error' : ''}`}
                  placeholder="Explain why this improvement is needed and how the university can implement it..."
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={DESC_MAX_LENGTH}
                  aria-required="true"
                  aria-invalid={!!errors.description}
                  aria-describedby={`desc-hint ${errors.description ? 'description-error' : ''}`}
                />
                <div className="form-field-meta">
                  {errors.description ? (
                    <p id="description-error" className="form-error-msg" role="alert">
                      <span aria-hidden="true">&bull;</span> {errors.description}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span
                    className={`char-counter ${getCounterClass(formData.description.length, DESC_MAX_LENGTH)}`}
                    aria-label={`${formData.description.length} of ${DESC_MAX_LENGTH} characters`}
                  >
                    {formData.description.length} / {DESC_MAX_LENGTH}
                  </span>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting Proposal...' : 'Submit Proposal'}
                </button>
                <Link to="/ideas" className="btn btn-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          </div>

          {/* Submission Guidelines Sidebar */}
          <aside className="submit-guidelines-card" aria-label="Proposal Guidelines">
            <div className="guidelines-header">
              <span className="guidelines-icon" aria-hidden="true">💡</span>
              <h3 className="guidelines-title">Tips for Great Proposals</h3>
            </div>
            <ul className="guidelines-list">
              <li className="guideline-item">
                <span className="guideline-bullet" aria-hidden="true">🎯</span>
                <div>
                  <strong>Be specific:</strong> Include clear details about location, scope, and timing.
                </div>
              </li>
              <li className="guideline-item">
                <span className="guideline-bullet" aria-hidden="true">🤝</span>
                <div>
                  <strong>Highlight student value:</strong> Mention who benefits and why it matters to the community.
                </div>
              </li>
              <li className="guideline-item">
                <span className="guideline-bullet" aria-hidden="true">🛠️</span>
                <div>
                  <strong>Keep it actionable:</strong> Suggest realistic, practical steps or solutions.
                </div>
              </li>
            </ul>

            <div className="guidelines-footer-note">
              <strong>Workflow note:</strong> Proposals start in the <em>Submitted</em> status and advance to <em>Under Review</em> as student interest grows.
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

export default SubmitIdeaPage
