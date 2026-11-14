import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ModeratorAnalyticsDashboard from '../../src/components/analytics/ModeratorAnalyticsDashboard'
import * as analyticsService from '../../src/services/analyticsService'

vi.mock('../../src/services/analyticsService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchModeratorAnalytics: vi.fn(),
  }
})

describe('ModeratorAnalyticsDashboard Component Suite (Issues #9 & #10)', () => {
  const mockModeratorUser = {
    uid: 'mod_user_123',
    email: 'mod@campus.edu',
    displayName: 'Campus Moderator',
  }

  const sampleIdeas = [
    {
      id: 'idea-1',
      title: '24/7 Library Quiet Floor',
      description: 'Keep library open overnight during finals week.',
      category: 'Facilities',
      status: 'Submitted',
      upvoteCount: 15,
      createdAtRaw: new Date(2026, 9, 10, 10, 0),
    },
    {
      id: 'idea-2',
      title: 'Water Bottle Refill Stations',
      description: 'Sensor activated bottle refill stations.',
      category: 'Sustainability',
      status: 'Under Review',
      upvoteCount: 22,
      createdAtRaw: new Date(2026, 9, 11, 14, 0),
    },
    {
      id: 'idea-3',
      title: 'Night Express Shuttle',
      description: 'Late night shuttle to metro station.',
      category: 'Transportation',
      status: 'In Progress',
      upvoteCount: 30,
      createdAtRaw: new Date(2026, 9, 12, 16, 0),
    },
    {
      id: 'idea-4',
      title: 'Gluten-Free Dining Hall Options',
      description: 'Dedicated allergen-free preparation stations.',
      category: 'Dining',
      status: 'Accepted',
      upvoteCount: 40,
      createdAtRaw: new Date(2026, 9, 12, 18, 0),
    },
    {
      id: 'idea-5',
      title: 'Solar Benches in Quad',
      description: 'Outdoor solar powered benches with USB charging.',
      category: 'Facilities',
      status: 'Implemented',
      upvoteCount: 50,
      createdAtRaw: new Date(2026, 9, 13, 11, 0),
    },
    {
      id: 'idea-6',
      title: 'Campus Arcade Room',
      description: 'Vintage arcade games in the student lounge.',
      category: 'Campus Life',
      status: 'Rejected',
      upvoteCount: 5,
      createdAtRaw: new Date(2026, 9, 14, 15, 0),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Security & Authorization Gating', () => {
    it('renders unauthorized notice when isModerator is false', () => {
      render(
        <ModeratorAnalyticsDashboard
          user={{ uid: 'student_123' }}
          isModerator={false}
        />
      )

      expect(screen.getByTestId('analytics-unauthorized')).toBeInTheDocument()
      expect(screen.getByText('Moderator Privileges Required')).toBeInTheDocument()
      expect(analyticsService.fetchModeratorAnalytics).not.toHaveBeenCalled()
    })
  })

  describe('Issue #9: Analytics UI & Visualizations', () => {
    it('displays loading state while analytics are being fetched', () => {
      analyticsService.fetchModeratorAnalytics.mockReturnValueOnce(new Promise(() => {}))

      render(
        <ModeratorAnalyticsDashboard
          user={mockModeratorUser}
          isModerator={true}
        />
      )

      expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()
      expect(screen.getByText('Loading Analytics Dashboard...')).toBeInTheDocument()
    })

    it('displays error state with a working retry action if fetching fails', async () => {
      analyticsService.fetchModeratorAnalytics
        .mockRejectedValueOnce(new Error('Network connection timeout'))
        .mockResolvedValueOnce({
          ideas: sampleIdeas,
          metrics: analyticsService.aggregateIdeaMetrics(sampleIdeas),
          fetchedAt: new Date(),
        })

      render(
        <ModeratorAnalyticsDashboard
          user={mockModeratorUser}
          isModerator={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('analytics-error')).toBeInTheDocument()
      })
      expect(screen.getByText('Network connection timeout')).toBeInTheDocument()

      const retryBtn = screen.getByTestId('analytics-retry-btn')
      fireEvent.click(retryBtn)

      await waitFor(() => {
        expect(screen.getByTestId('metric-card-total')).toBeInTheDocument()
      })
    })

    it('displays empty database state when no ideas exist', async () => {
      analyticsService.fetchModeratorAnalytics.mockResolvedValueOnce({
        ideas: [],
        metrics: analyticsService.aggregateIdeaMetrics([]),
        fetchedAt: new Date(),
      })

      render(
        <ModeratorAnalyticsDashboard
          user={mockModeratorUser}
          isModerator={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('analytics-empty-db')).toBeInTheDocument()
      })
      expect(screen.getByText('No Campus Ideas Found')).toBeInTheDocument()
    })

    it('renders all 6 metric cards with accurate values and status groupings', async () => {
      analyticsService.fetchModeratorAnalytics.mockResolvedValueOnce({
        ideas: sampleIdeas,
        metrics: analyticsService.aggregateIdeaMetrics(sampleIdeas),
        fetchedAt: new Date(),
      })

      render(
        <ModeratorAnalyticsDashboard
          user={mockModeratorUser}
          isModerator={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('metric-card-total')).toBeInTheDocument()
      })

      // Total Ideas
      expect(screen.getByTestId('metric-card-total')).toHaveTextContent('6')
      expect(screen.getByTestId('metric-card-total')).toHaveTextContent('Total Ideas')

      // Pending Review (Submitted + Under Review: idea-1 and idea-2 = 2)
      expect(screen.getByTestId('metric-card-pending-review')).toHaveTextContent('2')
      expect(screen.getByTestId('metric-card-pending-review')).toHaveTextContent('Pending Review')

      // In Progress (idea-3 = 1)
      expect(screen.getByTestId('metric-card-in-progress')).toHaveTextContent('1')
      expect(screen.getByTestId('metric-card-in-progress')).toHaveTextContent('In Progress')

      // Accepted (idea-4 = 1)
      expect(screen.getByTestId('metric-card-accepted')).toHaveTextContent('1')
      expect(screen.getByTestId('metric-card-accepted')).toHaveTextContent('Accepted')

      // Implemented (idea-5 = 1)
      expect(screen.getByTestId('metric-card-implemented')).toHaveTextContent('1')
      expect(screen.getByTestId('metric-card-implemented')).toHaveTextContent('Implemented')

      // Rejected (idea-6 = 1)
      expect(screen.getByTestId('metric-card-rejected')).toHaveTextContent('1')
      expect(screen.getByTestId('metric-card-rejected')).toHaveTextContent('Rejected')
    })

    it('renders all three charts (Status, Category, Submissions Trend)', async () => {
      analyticsService.fetchModeratorAnalytics.mockResolvedValueOnce({
        ideas: sampleIdeas,
        metrics: analyticsService.aggregateIdeaMetrics(sampleIdeas),
        fetchedAt: new Date(),
      })

      render(
        <ModeratorAnalyticsDashboard
          user={mockModeratorUser}
          isModerator={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('status-distribution-chart')).toBeInTheDocument()
      })

      // Status Chart
      expect(screen.getByTestId('status-distribution-chart')).toBeInTheDocument()
      expect(screen.getByText(/Idea Status Breakdown/i)).toBeInTheDocument()

      // Category Chart
      expect(screen.getByTestId('category-distribution-chart')).toBeInTheDocument()
      expect(screen.getByText(/Ideas by Category/i)).toBeInTheDocument()

      // Trend Chart
      expect(screen.getByTestId('submissions-trend-chart')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Submissions Over Time/i })).toBeInTheDocument()
    })
  })

  describe('Issue #10: Filters and Date Ranges', () => {
    it('filters metrics and charts by Category in real time without querying Firestore again', async () => {
      analyticsService.fetchModeratorAnalytics.mockResolvedValueOnce({
        ideas: sampleIdeas,
        metrics: analyticsService.aggregateIdeaMetrics(sampleIdeas),
        fetchedAt: new Date(),
      })

      render(
        <ModeratorAnalyticsDashboard
          user={mockModeratorUser}
          isModerator={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('analytics-category-select')).toBeInTheDocument()
      })

      // Initial query call count is 1
      expect(analyticsService.fetchModeratorAnalytics).toHaveBeenCalledTimes(1)

      // Filter by 'Facilities' (idea-1 and idea-5: 2 ideas total)
      const select = screen.getByTestId('analytics-category-select')
      fireEvent.change(select, { target: { value: 'Facilities' } })

      // Metric card total should now show 2
      expect(screen.getByTestId('metric-card-total')).toHaveTextContent('2')

      // Pending review should show 1 (idea-1), Implemented should show 1 (idea-5)
      expect(screen.getByTestId('metric-card-pending-review')).toHaveTextContent('1')
      expect(screen.getByTestId('metric-card-implemented')).toHaveTextContent('1')
      expect(screen.getByTestId('metric-card-accepted')).toHaveTextContent('0')

      // Ensure NO additional Firestore calls were made
      expect(analyticsService.fetchModeratorAnalytics).toHaveBeenCalledTimes(1)
    })

    it('filters metrics by preset Date Range pills in real time', async () => {
      // Use preloaded ideas for instant test execution
      render(
        <ModeratorAnalyticsDashboard
          user={mockModeratorUser}
          isModerator={true}
          initialIdeas={sampleIdeas}
        />
      )

      expect(screen.getByTestId('date-pill-7d')).toBeInTheDocument()
      const pill7d = screen.getByTestId('date-pill-7d')

      fireEvent.click(pill7d)
      expect(pill7d).toHaveClass('active')

      // Reset pill back to All Time
      const pillAll = screen.getByTestId('date-pill-all')
      fireEvent.click(pillAll)
      expect(pillAll).toHaveClass('active')
      expect(screen.getByTestId('metric-card-total')).toHaveTextContent('6')
    })

    it('renders empty filtered state and resets filters properly when Reset button is clicked', async () => {
      render(
        <ModeratorAnalyticsDashboard
          user={mockModeratorUser}
          isModerator={true}
          initialIdeas={sampleIdeas}
        />
      )

      // Filter by a category with 0 ideas in sample (e.g. 'Wellness')
      const select = screen.getByTestId('analytics-category-select')
      fireEvent.change(select, { target: { value: 'Wellness' } })

      // Empty filter notice should appear
      expect(screen.getByTestId('analytics-no-filter-match')).toBeInTheDocument()
      expect(screen.getByText('No Matching Ideas Found')).toBeInTheDocument()

      // Click Reset Filters button
      const resetBtn = screen.getByTestId('reset-filter-notice-btn')
      fireEvent.click(resetBtn)

      // Full dashboard should be restored
      expect(screen.getByTestId('metric-card-total')).toHaveTextContent('6')
      expect(screen.queryByTestId('analytics-no-filter-match')).not.toBeInTheDocument()
    })
  })
})
