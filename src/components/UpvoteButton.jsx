import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context'
import { toggleUpvote, hasUserUpvoted } from '../services/ideasService'
import SignInPromptModal from './SignInPromptModal'
import './UpvoteButton.css'

/**
 * Reusable Upvote Button component supporting idea cards and the detail page view.
 * Handles authenticated toggling, guest sign-in prompts with continuation,
 * and optimistic/authoritative count synchronization.
 *
 * @param {object} props
 * @param {string} props.ideaId - The document ID of the proposal.
 * @param {number|null} [props.upvoteCount] - Current vote count (null if unavailable).
 * @param {boolean} [props.hasUpvoted] - Initial upvote state from parent query.
 * @param {(data: { hasUpvoted: boolean, upvoteCount: number|null }) => void} [props.onVoteChange] - Callback to sync vote state with parent.
 * @param {'card'|'detail'} [props.variant='card'] - Display layout variant.
 * @param {string} [props.className] - Additional CSS class names.
 */
export function UpvoteButton({
  ideaId,
  upvoteCount = null,
  hasUpvoted = false,
  onVoteChange,
  variant = 'card',
  className = '',
}) {
  const { user } = useAuth()

  // Local overrides for optimistic and immediate transaction updates
  const [votedStatus, setVotedStatus] = useState(null)
  const [votedIdeaId, setVotedIdeaId] = useState(null)

  const [overrideCount, setOverrideCount] = useState(null)
  const [overrideIdeaId, setOverrideIdeaId] = useState(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [voteError, setVoteError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Derive active upvoted state cleanly without cascading render effects
  const isUpvoted = user
    ? votedIdeaId === ideaId && votedStatus !== null
      ? votedStatus
      : Boolean(hasUpvoted)
    : false

  // Derive active count
  const currentCount =
    overrideIdeaId === ideaId && overrideCount !== null
      ? overrideCount
      : typeof upvoteCount === 'number'
        ? upvoteCount
        : null

  // Asynchronously verify upvote state from Firestore whenever user or ideaId changes
  useEffect(() => {
    let isCancelled = false

    if (!ideaId || !user?.uid) {
      return undefined
    }

    async function verifyUserVote() {
      try {
        const userHasVoted = await hasUserUpvoted(ideaId, user.uid)
        if (!isCancelled) {
          setVotedStatus(userHasVoted)
          setVotedIdeaId(ideaId)
        }
      } catch (err) {
        console.warn(`Failed to check vote status for idea ${ideaId}:`, err)
      }
    }

    verifyUserVote()

    return () => {
      isCancelled = true
    }
  }, [ideaId, user?.uid])

  // Performs the actual vote/unvote transaction via ideasService.toggleUpvote
  const performVote = useCallback(
    async (actingUser) => {
      if (!ideaId || !actingUser?.uid || isSubmitting) {
        return
      }

      setIsSubmitting(true)
      setVoteError(null)

      try {
        const result = await toggleUpvote(ideaId, actingUser.uid)
        setVotedStatus(result.hasUpvoted)
        setVotedIdeaId(ideaId)

        let nextCount = currentCount
        if (typeof result.upvoteCount === 'number') {
          nextCount = result.upvoteCount
          setOverrideCount(result.upvoteCount)
          setOverrideIdeaId(ideaId)
        } else if (currentCount !== null) {
          // If authoritative count query was unavailable, update known count locally
          nextCount = result.hasUpvoted ? currentCount + 1 : Math.max(0, currentCount - 1)
          setOverrideCount(nextCount)
          setOverrideIdeaId(ideaId)
        }

        if (typeof onVoteChange === 'function') {
          onVoteChange({
            hasUpvoted: result.hasUpvoted,
            upvoteCount: nextCount,
          })
        }
      } catch (err) {
        console.error(`Failed to toggle upvote on idea ${ideaId}:`, err)
        setVoteError(err.message || 'Unable to update vote. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [ideaId, isSubmitting, currentCount, onVoteChange]
  )

  const handleClick = (e) => {
    // Prevent navigating if rendered inside a clickable card
    e.preventDefault()
    e.stopPropagation()

    if (isSubmitting) return

    setVoteError(null)

    // Unauthenticated visitors trigger the sign-in modal first
    if (!user) {
      setIsModalOpen(true)
      return
    }

    performVote(user)
  }

  // Completes the vote once the guest successfully completes Google Sign-In
  const handleModalSuccess = (signedInUser) => {
    if (signedInUser?.uid) {
      performVote(signedInUser)
    }
  }

  const isVoteCountUnavailable = currentCount === null

  const getAriaLabel = () => {
    if (variant === 'detail') {
      return isUpvoted
        ? 'Upvoted proposal. Click to remove upvote.'
        : 'Upvote this proposal.'
    }

    if (isVoteCountUnavailable) {
      return isUpvoted
        ? 'Upvoted (count unavailable). Click to remove upvote.'
        : 'Upvote this proposal (count unavailable).'
    }

    return isUpvoted
      ? `Upvoted. ${currentCount} ${currentCount === 1 ? 'upvote' : 'upvotes'}. Click to remove upvote.`
      : `Upvote this proposal. Current upvotes: ${currentCount}.`
  }

  return (
    <div
      className={`upvote-button-container upvote-container-${variant} ${className}`}
      data-prevent-card-nav="true"
      data-tour="idea-upvote"
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={isSubmitting}
        aria-pressed={isUpvoted}
        aria-label={getAriaLabel()}
        className={`upvote-btn upvote-btn-${variant} ${isUpvoted ? 'is-upvoted' : ''} ${
          isSubmitting ? 'is-loading' : ''
        }`}
        data-prevent-card-nav="true"
      >
        <span className="upvote-icon" aria-hidden="true">
          {isSubmitting ? (
            <span className="upvote-spinner" />
          ) : variant === 'detail' && isUpvoted ? (
            '✓'
          ) : (
            '▲'
          )}
        </span>

        {variant === 'card' && (
          <span className="upvote-count">
            {isVoteCountUnavailable ? 'Unavailable' : currentCount}
          </span>
        )}

        <span className="upvote-text">
          {isSubmitting
            ? variant === 'detail'
              ? 'Updating...'
              : 'Voting...'
            : isUpvoted
              ? 'Upvoted'
              : variant === 'detail'
                ? 'Upvote Proposal'
                : 'Upvote'}
        </span>

        {variant === 'detail' && typeof currentCount === 'number' && (
          <span className="upvote-pill" aria-hidden="true">
            {currentCount}
          </span>
        )}
      </button>

      {voteError && (
        <div className={`upvote-error-message upvote-error-${variant}`} role="alert">
          <span className="upvote-error-icon" aria-hidden="true">⚠️</span>
          <span>{voteError}</span>
        </div>
      )}

      {/* Guest Sign-In Prompt Modal */}
      <SignInPromptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}

export default UpvoteButton
