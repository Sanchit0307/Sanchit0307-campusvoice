import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UpvoteButton } from '../../src/components/UpvoteButton'
import { AuthContext } from '../../src/context/AuthContext'
import { toggleUpvote, hasUserUpvoted } from '../../src/services/ideasService'

vi.mock('../../src/services/ideasService', () => ({
  toggleUpvote: vi.fn(),
  hasUserUpvoted: vi.fn(),
}))

describe('UpvoteButton Component Suite', () => {
  const mockIdeaId = 'idea-test-123'

  beforeEach(() => {
    vi.clearAllMocks()
    hasUserUpvoted.mockResolvedValue(false)
  })

  function renderWithAuth(ui, authOverrides = {}) {
    const authContextValue = {
      user: null,
      loading: false,
      authError: null,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn(),
      isConfigured: true,
      isModerator: false,
      ...authOverrides,
    }

    return {
      ...render(
        <AuthContext.Provider value={authContextValue}>
          {ui}
        </AuthContext.Provider>
      ),
      authContextValue,
    }
  }

  it('opens SignInPromptModal and does not call toggleUpvote when signed out', () => {
    renderWithAuth(
      <UpvoteButton ideaId={mockIdeaId} upvoteCount={10} hasUpvoted={false} />
    )

    const button = screen.getByRole('button', { name: /upvote/i })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)

    // Modal dialog opens
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Sign In with Google to Upvote')).toBeInTheDocument()

    // No voting service call is made while unauthenticated
    expect(toggleUpvote).not.toHaveBeenCalled()
  })

  it('continues the requested vote once sign-in completes via the modal', async () => {
    const mockSignedInUser = { uid: 'guest_promoted_user', displayName: 'Guest Student' }
    const signInWithGoogleMock = vi.fn().mockResolvedValue(mockSignedInUser)
    toggleUpvote.mockResolvedValue({ hasUpvoted: true, upvoteCount: 11 })

    renderWithAuth(
      <UpvoteButton ideaId={mockIdeaId} upvoteCount={10} hasUpvoted={false} />,
      {
        user: null,
        signInWithGoogle: signInWithGoogleMock,
      }
    )

    // Click upvote button to launch modal
    const upvoteBtn = screen.getByRole('button', { name: /upvote/i })
    fireEvent.click(upvoteBtn)

    // Click Google sign-in inside modal
    const googleBtn = screen.getByRole('button', { name: /continue with google/i })
    fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(signInWithGoogleMock).toHaveBeenCalled()
      expect(toggleUpvote).toHaveBeenCalledWith(mockIdeaId, 'guest_promoted_user')
    })
  })

  it('allows authenticated users to vote and toggles to upvoted state', async () => {
    const authedUser = { uid: 'auth_user_1', displayName: 'Auth Student' }
    toggleUpvote.mockResolvedValue({ hasUpvoted: true, upvoteCount: 11 })

    renderWithAuth(
      <UpvoteButton ideaId={mockIdeaId} upvoteCount={10} hasUpvoted={false} />,
      { user: authedUser }
    )

    const button = screen.getByRole('button', { name: /upvote/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(button)

    await waitFor(() => {
      expect(toggleUpvote).toHaveBeenCalledWith(mockIdeaId, 'auth_user_1')
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('allows authenticated users to unvote when already upvoted', async () => {
    const authedUser = { uid: 'auth_user_2', displayName: 'Student Two' }
    hasUserUpvoted.mockResolvedValue(true)
    toggleUpvote.mockResolvedValue({ hasUpvoted: false, upvoteCount: 9 })

    renderWithAuth(
      <UpvoteButton ideaId={mockIdeaId} upvoteCount={10} hasUpvoted={true} />,
      { user: authedUser }
    )

    const button = screen.getByRole('button', { name: /upvote/i })

    // Wait for initial verification effect
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    fireEvent.click(button)

    await waitFor(() => {
      expect(toggleUpvote).toHaveBeenCalledWith(mockIdeaId, 'auth_user_2')
      expect(button).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('disables the button while a vote is submitting to prevent duplicate clicks', async () => {
    const authedUser = { uid: 'auth_user_3', displayName: 'Student Three' }
    // Never resolve immediately to inspect loading state
    let resolveVote
    toggleUpvote.mockReturnValue(
      new Promise((res) => {
        resolveVote = res
      })
    )

    renderWithAuth(
      <UpvoteButton ideaId={mockIdeaId} upvoteCount={10} hasUpvoted={false} />,
      { user: authedUser }
    )

    const button = screen.getByRole('button', { name: /upvote/i })
    expect(button).not.toBeDisabled()

    fireEvent.click(button)

    // Button should be disabled during in-flight submission
    expect(button).toBeDisabled()

    // Attempt second click while in-flight
    fireEvent.click(button)
    expect(toggleUpvote).toHaveBeenCalledTimes(1)

    // Clean up unresolved promise
    resolveVote({ hasUpvoted: true, upvoteCount: 11 })
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })

  it('displays an error alert and restores button state when toggleUpvote fails', async () => {
    const authedUser = { uid: 'auth_user_4', displayName: 'Student Four' }
    toggleUpvote.mockRejectedValue(new Error('Network connection error'))

    renderWithAuth(
      <UpvoteButton ideaId={mockIdeaId} upvoteCount={10} hasUpvoted={false} />,
      { user: authedUser }
    )

    const button = screen.getByRole('button', { name: /upvote/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Network connection error')).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })
  })

  it('notifies onVoteChange callback with new vote status and count', async () => {
    const authedUser = { uid: 'auth_user_5', displayName: 'Student Five' }
    const onVoteChangeMock = vi.fn()
    toggleUpvote.mockResolvedValue({ hasUpvoted: true, upvoteCount: 42 })

    renderWithAuth(
      <UpvoteButton
        ideaId={mockIdeaId}
        upvoteCount={41}
        hasUpvoted={false}
        onVoteChange={onVoteChangeMock}
      />,
      { user: authedUser }
    )

    const button = screen.getByRole('button', { name: /upvote/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(onVoteChangeMock).toHaveBeenCalledWith({
        hasUpvoted: true,
        upvoteCount: 42,
      })
    })
  })
})
