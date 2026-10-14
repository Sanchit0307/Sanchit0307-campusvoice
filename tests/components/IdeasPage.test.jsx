import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import IdeasPage from '../../src/pages/IdeasPage'
import { AuthContext } from '../../src/context/AuthContext'
import { getIdeas } from '../../src/services/ideasService'

vi.mock('../../src/services/ideasService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getIdeas: vi.fn(),
    toggleUpvote: vi.fn(),
    hasUserUpvoted: vi.fn().mockResolvedValue(false),
  }
})

describe('IdeasPage Component Suite', () => {
  const sampleIdeas = [
    {
      id: 'idea-1',
      title: 'Solar Panels on Student Center Roof',
      description: 'Install clean solar collectors across the union roof.',
      category: 'Sustainability',
      status: 'In Progress',
      upvoteCount: 45,
      createdAt: '2 days ago',
      createdAtRaw: { seconds: 1700000200 },
    },
    {
      id: 'idea-2',
      title: '24/7 Library Study Rooms for Midterms',
      description: 'Open the main library second floor study rooms 24/7.',
      category: 'Facilities',
      status: 'Under Review',
      upvoteCount: 30,
      createdAt: '4 days ago',
      createdAtRaw: { seconds: 1700000100 },
    },
    {
      id: 'idea-3',
      title: 'Expanded Healthy Dining Options',
      description: 'Add more plant-based and gluten-free stations in central dining.',
      category: 'Dining',
      status: 'Submitted',
      upvoteCount: 15,
      createdAt: '1 week ago',
      createdAtRaw: { seconds: 1700000050 },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderIdeasPage(authOverrides = {}) {
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

    return render(
      <MemoryRouter>
        <AuthContext.Provider value={authContextValue}>
          <IdeasPage />
        </AuthContext.Provider>
      </MemoryRouter>
    )
  }

  it('renders loading state initially while fetching ideas', () => {
    // Return an unresolved promise to check loading state
    getIdeas.mockReturnValue(new Promise(() => {}))
    renderIdeasPage()

    expect(screen.getByText('Loading Campus Ideas...')).toBeInTheDocument()
  })

  it('renders empty state when no ideas exist in the database', async () => {
    getIdeas.mockResolvedValue([])
    renderIdeasPage()

    await waitFor(() => {
      expect(screen.getByText('No Campus Ideas Yet')).toBeInTheDocument()
      expect(
        screen.getByText(/there are currently no proposals in the feed/i)
      ).toBeInTheDocument()
    })
  })

  it('renders populated list with search and filter controls when ideas are loaded', async () => {
    getIdeas.mockResolvedValue(sampleIdeas)
    renderIdeasPage()

    await waitFor(() => {
      expect(screen.getByText('Solar Panels on Student Center Roof')).toBeInTheDocument()
      expect(screen.getByText('24/7 Library Study Rooms for Midterms')).toBeInTheDocument()
      expect(screen.getByText('Expanded Healthy Dining Options')).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/search proposals/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter proposals by category/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter proposals by status/i)).toBeInTheDocument()
  })

  it('filters displayed ideas when entering a search query', async () => {
    getIdeas.mockResolvedValue(sampleIdeas)
    renderIdeasPage()

    await waitFor(() => {
      expect(screen.getByText('Solar Panels on Student Center Roof')).toBeInTheDocument()
    })

    const searchInput = screen.getByLabelText(/search proposals/i)
    fireEvent.change(searchInput, { target: { value: 'library' } })

    expect(screen.getByText('24/7 Library Study Rooms for Midterms')).toBeInTheDocument()
    expect(screen.queryByText('Solar Panels on Student Center Roof')).not.toBeInTheDocument()
    expect(screen.queryByText('Expanded Healthy Dining Options')).not.toBeInTheDocument()
  })

  it('filters displayed ideas by category and status', async () => {
    getIdeas.mockResolvedValue(sampleIdeas)
    renderIdeasPage()

    await waitFor(() => {
      expect(screen.getByText('Solar Panels on Student Center Roof')).toBeInTheDocument()
    })

    // Filter by Sustainability category
    const categorySelect = screen.getByLabelText(/filter proposals by category/i)
    fireEvent.change(categorySelect, { target: { value: 'Sustainability' } })

    expect(screen.getByText('Solar Panels on Student Center Roof')).toBeInTheDocument()
    expect(screen.queryByText('24/7 Library Study Rooms for Midterms')).not.toBeInTheDocument()
    expect(screen.queryByText('Expanded Healthy Dining Options')).not.toBeInTheDocument()

    // Filter by In Progress status
    const statusSelect = screen.getByLabelText(/filter proposals by status/i)
    fireEvent.change(statusSelect, { target: { value: 'In Progress' } })

    expect(screen.getByText('Solar Panels on Student Center Roof')).toBeInTheDocument()
  })

  it('resets all active search and filter criteria when clicking Reset Filters', async () => {
    getIdeas.mockResolvedValue(sampleIdeas)
    renderIdeasPage()

    await waitFor(() => {
      expect(screen.getByText('Solar Panels on Student Center Roof')).toBeInTheDocument()
    })

    // Apply a search filter
    const searchInput = screen.getByLabelText(/search proposals/i)
    fireEvent.change(searchInput, { target: { value: 'solar' } })

    expect(screen.queryByText('24/7 Library Study Rooms for Midterms')).not.toBeInTheDocument()

    // Click Reset Filters
    const resetBtn = screen.getByRole('button', { name: /reset all search, filter, and sorting controls/i })
    fireEvent.click(resetBtn)

    // All ideas are visible again
    expect(searchInput).toHaveValue('')
    expect(screen.getByText('Solar Panels on Student Center Roof')).toBeInTheDocument()
    expect(screen.getByText('24/7 Library Study Rooms for Midterms')).toBeInTheDocument()
    expect(screen.getByText('Expanded Healthy Dining Options')).toBeInTheDocument()
  })

  it('displays the no-match card when criteria matches zero proposals', async () => {
    getIdeas.mockResolvedValue(sampleIdeas)
    renderIdeasPage()

    await waitFor(() => {
      expect(screen.getByText('Solar Panels on Student Center Roof')).toBeInTheDocument()
    })

    const searchInput = screen.getByLabelText(/search proposals/i)
    fireEvent.change(searchInput, { target: { value: 'completely unmatched proposal query' } })

    expect(screen.getByText('No matching proposals found')).toBeInTheDocument()
    expect(
      screen.getByText(/we couldn't find any proposals matching your current search or filter criteria/i)
    ).toBeInTheDocument()

    // Can reset directly from the no-match card
    const resetCardBtn = screen.getByRole('button', { name: /reset search & filters/i })
    fireEvent.click(resetCardBtn)

    expect(screen.getByText('Solar Panels on Student Center Roof')).toBeInTheDocument()
  })
})
