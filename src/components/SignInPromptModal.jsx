import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context'
import './SignInPromptModal.css'

/**
 * Accessible Modal dialog prompting guests to authenticate with Google.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal dialog is visible.
 * @param {() => void} props.onClose - Callback triggered to dismiss the dialog.
 * @param {string} [props.title] - Optional custom title.
 * @param {string} [props.description] - Optional custom description.
 * @param {() => void} [props.onSuccess] - Optional callback triggered after successful sign in.
 */
export function SignInPromptModal({
  isOpen,
  onClose,
  title = 'Sign In with Google to Upvote',
  description = 'Your upvote helps campus student representatives and administration identify which student proposals have the strongest campus backing.',
  onSuccess,
}) {
  const { signInWithGoogle, isConfigured } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const primaryButtonRef = useRef(null)

  const handleDismiss = useCallback(() => {
    setErrorMessage(null)
    setIsSubmitting(false)
    onClose()
  }, [onClose])

  // Focus management and escape key dismiss listener
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousActiveElement = document.activeElement
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleDismiss()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    // Focus the primary action button for immediate keyboard accessibility
    const timer = setTimeout(() => {
      if (primaryButtonRef.current) {
        primaryButtonRef.current.focus()
      }
    }, 50)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus()
      }
    }
  }, [isOpen, handleDismiss])

  if (!isOpen) {
    return null
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      handleDismiss()
    }
  }

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return

    if (!isConfigured) {
      setErrorMessage(
        'Firebase Authentication is not configured. Please define your VITE_FIREBASE_* credentials in .env.'
      )
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const user = await signInWithGoogle()
      if (user) {
        if (typeof onSuccess === 'function') {
          onSuccess(user)
        }
        handleDismiss()
      }
    } catch (err) {
      console.error('Sign-in prompt failed:', err)
      const code = err?.code || ''
      if (code === 'auth/unauthorized-domain') {
        setErrorMessage(
          'This domain is not authorized in Firebase Console. Please add localhost to Authorized Domains.'
        )
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('Network connection error. Please check your internet connection.')
      } else {
        setErrorMessage(err.message || 'Unable to sign in. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="auth-modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="auth-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-desc"
      >
        <button
          type="button"
          className="auth-modal-close-btn"
          onClick={handleDismiss}
          aria-label="Close authentication prompt"
          disabled={isSubmitting}
        >
          &times;
        </button>

        <div className="auth-modal-icon-badge" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        </div>

        <h2 id="auth-modal-title" className="auth-modal-title">
          {title}
        </h2>

        <p id="auth-modal-desc" className="auth-modal-desc">
          {description}
        </p>

        {errorMessage && (
          <div className="auth-modal-error-banner" role="alert">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="auth-modal-actions">
          <button
            type="button"
            ref={primaryButtonRef}
            onClick={handleGoogleSignIn}
            className="auth-modal-google-btn"
            disabled={isSubmitting}
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
            {isSubmitting ? 'Signing in...' : 'Continue with Google'}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="auth-modal-cancel-btn"
            disabled={isSubmitting}
          >
            Continue browsing as guest
          </button>
        </div>

        <p className="auth-modal-privacy-note">
          Public student participation is tied to your verified Google account.
        </p>
      </div>
    </div>
  )
}

export default SignInPromptModal
