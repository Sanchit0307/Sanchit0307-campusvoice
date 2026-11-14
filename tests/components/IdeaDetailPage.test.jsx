import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import IdeaDetailPage from '../../src/pages/IdeaDetailPage'
import { AuthContext } from '../../src/context/AuthContext'
import {
  getIdeaById,
  getStatusHistory,
  updateIdeaStatus,
} from '../../src/services/ideasService'

vi.mock('../../src/services/ideasService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getIdeaById: vi.fn(),
    getStatusHistory: vi.fn(),
    updateIdeaStatus: vi.fn(),
    toggleUpvote: vi.fn(),
    hasUserUpvoted: vi.fn().mockResolvedValue(false),
  }
})

describe('IdeaDetailPage Component Suite (Milestone 3 Timeline Integration)', () => {
  const sampleIdea = {
    id: 'idea-detail-1',
    title: 'Solar Charging Benches on North Quad',
    description: 'Install outdoor weather-proof solar benches with USB-C chargers.',
    category: 'Sustainability',
    authorId: 'student_123',
    authorName: 'Alex Student',
    status: 'Under Review',
    upvoteCount: 42,
    upvotes: 42,
    hasUpvoted: false,
    createdAt: 'Oct 10, 2026',
    createdAtRaw: new Date(2026, 9, 10),
    updatedAt: 'Oct 12, 2026',
  }

  const sampleHistory = [
    {
      id: 'idea-detail-1_Submitted_to_Under_Review_1700000000',
      ideaId: 'idea-detail-1',
      previousStatus: 'Submitted',
      newStatus: 'Under Review',
      changedAt: 'Oct 12, 2026',
      changedBy: 'mod_1',
      description: 'Status changed from Submitted to Under Review',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderIdeaDetailPage({
    user = { uid: 'student_123', email: 'alex@campus.edu' },
    isModerator = false,
    route = '/ideas/idea-detail-1',
  } = {}) {
    return render(
      <AuthContext.Provider
        value={{
          user,
          isModerator,
          loading: false,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/ideas/:id" element={<IdeaDetailPage />} />
            <Route path="/ideas" element={<IdeaDetailPage />} />
            <Route path="/ideas-list" element={<div>Ideas Listing Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  it('renders idea details and integrates the status history timeline', async () => {
    getIdeaById.mockResolvedValueOnce(sampleIdea)
    getStatusHistory.mockResolvedValueOnce(sampleHistory)

    renderIdeaDetailPage()

    // Verifies loading state initial presence
    expect(screen.getByText(/loading proposal details/i)).toBeInTheDocument()

    // Await idea loading
    await waitFor(() => {
      expect(screen.getByText('Solar Charging Benches on North Quad')).toBeInTheDocument()
    })

    // Verifies timeline section presence and events
    expect(screen.getByRole('region', { name: /status history timeline/i })).toBeInTheDocument()
    expect(screen.getAllByText('Submitted').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Under Review').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Current Status').length).toBeGreaterThanOrEqual(1)
  })

  it('allows authorized moderators to update status and refreshes the timeline', async () => {
    getIdeaById.mockResolvedValueOnce(sampleIdea)
    getStatusHistory.mockResolvedValueOnce(sampleHistory)
    updateIdeaStatus.mockResolvedValueOnce({
      updated: true,
      previousStatus: 'Under Review',
      newStatus: 'Accepted',
    })

    // After status update, getStatusHistory returns the new event
    const updatedHistory = [
      ...sampleHistory,
      {
        id: 'idea-detail-1_Under_Review_to_Accepted_1700000001',
        ideaId: 'idea-detail-1',
        previousStatus: 'Under Review',
        newStatus: 'Accepted',
        changedAt: 'Just now',
        changedBy: 'mod_user',
        description: 'Status changed from Under Review to Accepted',
      },
    ]
    getStatusHistory.mockResolvedValueOnce(updatedHistory)

    renderIdeaDetailPage({ isModerator: true })

    await waitFor(() => {
      expect(screen.getByText('Solar Charging Benches on North Quad')).toBeInTheDocument()
    })

    // Moderator Workflow Controls form
    const select = screen.getByLabelText(/change status/i)
    fireEvent.change(select, { target: { value: 'Accepted' } })

    const applyButton = screen.getByRole('button', { name: /apply status update/i })
    expect(applyButton).not.toBeDisabled()
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(updateIdeaStatus).toHaveBeenCalledWith('idea-detail-1', 'Accepted')
      expect(
        screen.getByText(/proposal status successfully updated to "Accepted"/i)
      ).toBeInTheDocument()
    })

    // Verifies timeline was refreshed with newly created event
    await waitFor(() => {
      expect(getStatusHistory).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Status changed from Under Review to Accepted')).toBeInTheDocument()
    })
  })

  it('displays not-found card when idea does not exist in Firestore', async () => {
    getIdeaById.mockResolvedValueOnce(null)
    getStatusHistory.mockResolvedValueOnce([])

    renderIdeaDetailPage({ route: '/ideas/non-existent-id' })

    await waitFor(() => {
      expect(screen.getByText('Idea Not Found')).toBeInTheDocument()
      expect(screen.getByText(/we couldn't find an idea with the identifier/i)).toBeInTheDocument()
    })
  })

  it('handles missing idea ID gracefully without infinite loading spinner', async () => {
    renderIdeaDetailPage({ route: '/ideas' })

    // Immediately leaves loading state and presents Idea Not Found
    await waitFor(() => {
      expect(screen.queryByText(/loading proposal details/i)).not.toBeInTheDocument()
      expect(screen.getByText('Idea Not Found')).toBeInTheDocument()
      expect(screen.getByText(/we couldn't find an idea with the identifier/i)).toBeInTheDocument()
      expect(screen.getByText('"unknown"')).toBeInTheDocument()
    })

    // Does not issue network calls for missing ID
    expect(getIdeaById).not.toHaveBeenCalled()
    expect(getStatusHistory).not.toHaveBeenCalled()
  })
})
