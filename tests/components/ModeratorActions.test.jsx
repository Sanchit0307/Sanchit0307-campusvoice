import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DashboardPage from '../../src/pages/DashboardPage'
import { AuthContext } from '../../src/context/AuthContext'
import * as ideasService from '../../src/services/ideasService'

vi.mock('../../src/services/ideasService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getUserIdeas: vi.fn().mockResolvedValue([]),
    getIdeas: vi.fn(),
    updateIdeaStatus: vi.fn(),
    rejectIdea: vi.fn(),
    deleteIdea: vi.fn(),
  }
})

describe('Moderator Reject & Remove Actions Suite', () => {
  const mockQueueIdeas = [
    {
      id: 'idea-1',
      title: 'Overnight Library Study Pods',
      description: 'Keep study pods open 24/7 during midterm and final exam weeks.',
      category: 'Facilities',
      status: 'Submitted',
      upvoteCount: 12,
      createdAt: 'Oct 10, 2026',
    },
    {
      id: 'idea-2',
      title: 'Helicopter Campus Shuttle',
      description: 'Luxury helicopter transport between dorms and lecture halls.',
      category: 'Transportation',
      status: 'Rejected',
      upvoteCount: 2,
      createdAt: 'Oct 9, 2026',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ideasService.getIdeas.mockResolvedValue([...mockQueueIdeas])
    ideasService.updateIdeaStatus.mockResolvedValue()
    ideasService.rejectIdea.mockResolvedValue()
    ideasService.deleteIdea.mockResolvedValue()
  })

  function renderModerationQueue(authOverrides = {}) {
    const authValues = {
      user: { uid: 'mod_uid_1', displayName: 'Prof. Miller' },
      isModerator: true,
      loading: false,
      isConfigured: true,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn(),
      ...authOverrides,
    }

    return render(
      <MemoryRouter initialEntries={['/dashboard?tab=moderation-queue']}>
        <AuthContext.Provider value={authValues}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    )
  }

  describe('Reject Idea Feature', () => {
    it('moderator can reject an idea directly from the queue', async () => {
      renderModerationQueue()

      await waitFor(() => {
        expect(screen.getByText('Overnight Library Study Pods')).toBeInTheDocument()
      })

      // The first idea is 'Submitted', so the Reject button should be present
      const rejectButton = screen.getByRole('button', {
        name: /reject proposal: overnight library study pods/i,
      })
      expect(rejectButton).toBeInTheDocument()

      fireEvent.click(rejectButton)

      await waitFor(() => {
        expect(ideasService.rejectIdea).toHaveBeenCalledWith('idea-1')
        expect(screen.getByText(/proposal status updated to "rejected"/i)).toBeInTheDocument()
      })
    })

    it('rejected ideas remain stored in the queue and display correct status', async () => {
      renderModerationQueue()

      await waitFor(() => {
        expect(screen.getByText('Helicopter Campus Shuttle')).toBeInTheDocument()
      })

      // For idea-2, status is already 'Rejected', so no redundant Reject button is shown
      expect(
        screen.queryByRole('button', { name: /reject proposal: helicopter campus shuttle/i })
      ).not.toBeInTheDocument()

      // The status dropdown displays Rejected (Current)
      const dropdown = screen.getByLabelText(/status:/i, { selector: '#queue-status-idea-2' })
      expect(dropdown).toHaveValue('Rejected')
    })

    it('ordinary students cannot access moderation queue or view reject action', async () => {
      const authStudent = {
        user: { uid: 'student_123', displayName: 'Alice Student' },
        isModerator: false,
        loading: false,
        isConfigured: true,
        signInWithGoogle: vi.fn(),
        signOutUser: vi.fn(),
      }

      renderModerationQueue(authStudent)

      await waitFor(() => {
        // Queue is protected: student sees their own dashboard instead
        expect(screen.queryByText(/campus moderation queue/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /reject proposal/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /remove proposal/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Remove Idea Feature', () => {
    it('moderator clicking remove opens confirmation dialog identifying the idea', async () => {
      renderModerationQueue()

      await waitFor(() => {
        expect(screen.getByText('Overnight Library Study Pods')).toBeInTheDocument()
      })

      const removeBtn = screen.getByRole('button', {
        name: /remove proposal: overnight library study pods/i,
      })
      fireEvent.click(removeBtn)

      // Dialog is open and identifies the proposal
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /remove proposal/i })).toBeInTheDocument()
      expect(
        screen.getByText(/are you sure you want to permanently remove/i)
      ).toBeInTheDocument()
      expect(screen.getByText('"Overnight Library Study Pods"')).toBeInTheDocument()
    })

    it('cancelling deletion closes the dialog and leaves the idea untouched', async () => {
      renderModerationQueue()

      await waitFor(() => {
        expect(screen.getByText('Overnight Library Study Pods')).toBeInTheDocument()
      })

      const removeBtn = screen.getByRole('button', {
        name: /remove proposal: overnight library study pods/i,
      })
      fireEvent.click(removeBtn)

      const cancelBtn = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelBtn)

      // Modal is closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      // Service deleteIdea was NOT called
      expect(ideasService.deleteIdea).not.toHaveBeenCalled()

      // Idea remains in the queue
      expect(screen.getByText('Overnight Library Study Pods')).toBeInTheDocument()
    })

    it('confirming removal calls deleteIdea and removes the idea from the queue', async () => {
      renderModerationQueue()

      await waitFor(() => {
        expect(screen.getByText('Overnight Library Study Pods')).toBeInTheDocument()
      })

      const removeBtn = screen.getByRole('button', {
        name: /remove proposal: overnight library study pods/i,
      })
      fireEvent.click(removeBtn)

      const confirmBtn = screen.getByRole('button', { name: /delete proposal/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(ideasService.deleteIdea).toHaveBeenCalledWith('idea-1')
        // Modal is closed
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        // Idea is removed from DOM
        expect(screen.queryByText('Overnight Library Study Pods')).not.toBeInTheDocument()
        // Success banner is shown
        expect(
          screen.getByText(/overnight library study pods.*and all associated votes were permanently removed/i)
        ).toBeInTheDocument()
      })
    })

    it('shows error banner in modal if deletion fails and keeps the idea in queue', async () => {
      ideasService.deleteIdea.mockRejectedValueOnce(
        new Error('Network error deleting document from Firestore.')
      )

      renderModerationQueue()

      await waitFor(() => {
        expect(screen.getByText('Overnight Library Study Pods')).toBeInTheDocument()
      })

      const removeBtn = screen.getByRole('button', {
        name: /remove proposal: overnight library study pods/i,
      })
      fireEvent.click(removeBtn)

      const confirmBtn = screen.getByRole('button', { name: /delete proposal/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(
          screen.getByText(/network error deleting document from firestore/i)
        ).toBeInTheDocument()
      })

      // Cancel closes modal and leaves idea in queue
      const cancelBtn = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelBtn)

      expect(screen.getByText('Overnight Library Study Pods')).toBeInTheDocument()
    })
  })
})
