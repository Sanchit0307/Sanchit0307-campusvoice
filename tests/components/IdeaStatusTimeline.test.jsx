import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IdeaStatusTimeline from '../../src/components/IdeaStatusTimeline'

describe('IdeaStatusTimeline Component Suite', () => {
  const baseIdea = {
    id: 'idea-100',
    title: 'Outdoor Solar Study Pods',
    status: 'In Progress',
    createdAt: 'Oct 1, 2026',
    createdAtRaw: new Date(2026, 9, 1),
    authorId: 'student_1',
    authorName: 'Taylor Student',
  }

  describe('Loading and Error States', () => {
    it('renders accessible loading state when loading is true', () => {
      render(<IdeaStatusTimeline idea={baseIdea} loading={true} />)

      const loadingRegion = screen.getByRole('status')
      expect(loadingRegion).toBeInTheDocument()
      expect(screen.getByText(/loading status history/i)).toBeInTheDocument()
    })

    it('renders error state and triggers onRetry when retry button is clicked', () => {
      const onRetryMock = vi.fn()
      render(
        <IdeaStatusTimeline
          idea={baseIdea}
          loading={false}
          error="Network error fetching history"
          onRetry={onRetryMock}
        />
      )

      const alertRegion = screen.getByRole('alert')
      expect(alertRegion).toBeInTheDocument()
      expect(screen.getByText('Unable to Load Status History')).toBeInTheDocument()
      expect(screen.getByText('Network error fetching history')).toBeInTheDocument()

      const retryBtn = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryBtn)
      expect(onRetryMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Empty and Legacy Fallback States (Honest Handling)', () => {
    it('renders empty fallback message when idea has no recorded history and no createdAt timestamp', () => {
      render(
        <IdeaStatusTimeline
          idea={{ id: 'idea-empty', status: 'Submitted', createdAt: null }}
          history={[]}
        />
      )

      expect(
        screen.getByText('Status history is not available for earlier updates.')
      ).toBeInTheDocument()
    })

    it('displays honest legacy notice and initial submission for legacy ideas without recorded status transitions', () => {
      // Legacy idea created long ago, reached "In Progress" prior to milestone tracking
      const legacyIdea = {
        id: 'legacy-idea-1',
        title: 'Legacy Campus Idea',
        status: 'In Progress',
        createdAt: 'Sep 15, 2026',
        createdAtRaw: new Date(2026, 8, 15),
        authorName: 'Morgan Alumni',
      }

      render(<IdeaStatusTimeline idea={legacyIdea} history={[]} />)

      // Shows honest legacy notice warning
      expect(screen.getByText('Legacy Proposal Notice')).toBeInTheDocument()
      expect(
        screen.getByText(/status history is not available for earlier updates/i)
      ).toBeInTheDocument()

      // Shows initial submission from actual stored createdAt honestly without fabricating intermediate stages
      expect(screen.getByText('Sep 15, 2026')).toBeInTheDocument()
      expect(screen.getByText('Proposal submitted to the campus ideas portal')).toBeInTheDocument()
    })

    it('displays single submitted milestone for new ideas at Submitted status', () => {
      const newIdea = {
        id: 'idea-new-1',
        title: 'New Student Proposal',
        status: 'Submitted',
        createdAt: 'Oct 17, 2026',
        createdAtRaw: new Date(2026, 9, 17),
        authorName: 'Alex Freshman',
      }

      render(<IdeaStatusTimeline idea={newIdea} history={[]} />)

      expect(screen.getByText('Oct 17, 2026')).toBeInTheDocument()
      expect(screen.getByText('Submitted')).toBeInTheDocument()
      expect(screen.getByText('Current Status')).toBeInTheDocument()
      expect(screen.queryByText('Legacy Proposal Notice')).not.toBeInTheDocument()
    })
  })

  describe('Chronological Timeline Ordering and Status Rendering', () => {
    const multiEventHistory = [
      {
        id: 'hist-1',
        ideaId: 'idea-100',
        previousStatus: 'Submitted',
        newStatus: 'Under Review',
        changedAt: 'Oct 3, 2026',
        changedBy: 'mod_1',
        description: 'Status changed from Submitted to Under Review',
      },
      {
        id: 'hist-2',
        ideaId: 'idea-100',
        previousStatus: 'Under Review',
        newStatus: 'In Progress',
        changedAt: 'Oct 8, 2026',
        changedBy: 'mod_2',
        description: 'Status changed from Under Review to In Progress',
      },
    ]

    it('renders timeline events in chronological sequence from oldest to newest', () => {
      render(<IdeaStatusTimeline idea={baseIdea} history={multiEventHistory} />)

      const timelineItems = screen.getAllByRole('listitem')
      // 3 items: Initial Submission (Oct 1) -> Under Review (Oct 3) -> In Progress (Oct 8)
      expect(timelineItems).toHaveLength(3)

      expect(timelineItems[0]).toHaveTextContent('Submitted')
      expect(timelineItems[0]).toHaveTextContent('Oct 1, 2026')

      expect(timelineItems[1]).toHaveTextContent('Under Review')
      expect(timelineItems[1]).toHaveTextContent('Oct 3, 2026')

      expect(timelineItems[2]).toHaveTextContent('In Progress')
      expect(timelineItems[2]).toHaveTextContent('Oct 8, 2026')
    })

    it('clearly distinguishes current status with visual pill badge and aria-current="step"', () => {
      render(<IdeaStatusTimeline idea={baseIdea} history={multiEventHistory} />)

      const timelineItems = screen.getAllByRole('listitem')
      const currentItem = timelineItems[2] // Last item: In Progress

      expect(currentItem).toHaveAttribute('aria-current', 'step')
      expect(currentItem).toHaveClass('is-current')
      expect(currentItem).toHaveTextContent('Current Status')

      // Earlier items must not be marked as current
      expect(timelineItems[0]).not.toHaveAttribute('aria-current')
      expect(timelineItems[1]).not.toHaveAttribute('aria-current')
    })

    it('deduplicates duplicate history entries by event ID gracefully', () => {
      const duplicateHistory = [
        ...multiEventHistory,
        // Exact duplicate of hist-2
        {
          id: 'hist-2',
          ideaId: 'idea-100',
          previousStatus: 'Under Review',
          newStatus: 'In Progress',
          changedAt: 'Oct 8, 2026',
        },
      ]

      render(<IdeaStatusTimeline idea={baseIdea} history={duplicateHistory} />)

      const timelineItems = screen.getAllByRole('listitem')
      // Duplicate hist-2 is dropped; exactly 3 unique items rendered
      expect(timelineItems).toHaveLength(3)
    })

    it('handles missing or malformed timestamps honestly as Date unavailable without fabricating historical dates', () => {
      const corruptHistory = [
        {
          id: 'hist-null',
          ideaId: 'idea-100',
          previousStatus: 'Submitted',
          newStatus: 'Under Review',
          changedAt: null,
          description: 'Review started',
        },
      ]

      render(
        <IdeaStatusTimeline
          idea={{ ...baseIdea, createdAt: null }}
          history={corruptHistory}
        />
      )

      expect(screen.getByText('Under Review')).toBeInTheDocument()
      expect(screen.getByText('Review started')).toBeInTheDocument()
      expect(screen.getByText('Date unavailable')).toBeInTheDocument()
      expect(screen.queryByText('Just now')).not.toBeInTheDocument()
    })
  })

  describe('Actor Attribution Labels', () => {
    it('attributes initial Submitted history event to student author and later transitions to moderator', () => {
      const historyWithInitial = [
        {
          id: 'hist-init',
          ideaId: 'idea-100',
          previousStatus: null,
          newStatus: 'Submitted',
          changedAt: 'Oct 1, 2026',
          changedBy: 'student_1',
          description: 'Proposal submitted',
        },
        {
          id: 'hist-mod',
          ideaId: 'idea-100',
          previousStatus: 'Submitted',
          newStatus: 'Under Review',
          changedAt: 'Oct 5, 2026',
          changedBy: 'mod_1',
          description: 'Review underway',
        },
      ]

      render(<IdeaStatusTimeline idea={baseIdea} history={historyWithInitial} />)

      // Initial event must be attributed to the author, not the moderator
      expect(screen.getByText('Submitted by Taylor Student')).toBeInTheDocument()

      // Later transition event must be attributed to moderator
      expect(screen.getByText('Updated by moderator')).toBeInTheDocument()
    })

    it('attributes anonymous initial submission accurately', () => {
      const anonymousIdea = {
        ...baseIdea,
        authorId: null,
        authorName: 'Anonymous Student',
      }
      const anonymousHistory = [
        {
          id: 'hist-init-anon',
          ideaId: 'idea-100',
          previousStatus: null,
          newStatus: 'Submitted',
          changedAt: 'Oct 1, 2026',
          changedBy: null,
          description: 'Proposal submitted',
        },
      ]

      render(<IdeaStatusTimeline idea={anonymousIdea} history={anonymousHistory} />)

      expect(screen.getByText('Submitted by Anonymous Student')).toBeInTheDocument()
      expect(screen.queryByText('Updated by moderator')).not.toBeInTheDocument()
    })

    it('attributes anonymous submission without authorName as Submitted anonymously', () => {
      const anonymousNoNameIdea = {
        ...baseIdea,
        authorId: null,
        authorName: '',
      }
      const anonymousHistory = [
        {
          id: 'hist-init-anon-noname',
          ideaId: 'idea-100',
          previousStatus: null,
          newStatus: 'Submitted',
          changedAt: 'Oct 1, 2026',
          changedBy: null,
          description: 'Proposal submitted',
        },
      ]

      render(<IdeaStatusTimeline idea={anonymousNoNameIdea} history={anonymousHistory} />)

      expect(screen.getByText('Submitted anonymously')).toBeInTheDocument()
      expect(screen.queryByText('Updated by moderator')).not.toBeInTheDocument()
    })

    it('attributes moderator transition back to Submitted from Under Review as Updated by moderator', () => {
      const historyWithReversion = [
        {
          id: 'hist-init',
          ideaId: 'idea-100',
          previousStatus: null,
          newStatus: 'Submitted',
          changedAt: 'Oct 1, 2026',
          changedBy: 'student_1',
          description: 'Proposal submitted',
        },
        {
          id: 'hist-review',
          ideaId: 'idea-100',
          previousStatus: 'Submitted',
          newStatus: 'Under Review',
          changedAt: 'Oct 3, 2026',
          changedBy: 'mod_1',
          description: 'Status changed from Submitted to Under Review',
        },
        {
          id: 'hist-revert',
          ideaId: 'idea-100',
          previousStatus: 'Under Review',
          newStatus: 'Submitted',
          changedAt: 'Oct 5, 2026',
          changedBy: 'mod_2',
          description: 'Status changed from Under Review to Submitted',
        },
      ]

      render(
        <IdeaStatusTimeline
          idea={{ ...baseIdea, status: 'Submitted' }}
          history={historyWithReversion}
        />
      )

      // Initial submission event is attributed to the student author
      expect(screen.getByText('Submitted by Taylor Student')).toBeInTheDocument()

      // Both the transition to Under Review and the reversion back to Submitted are attributed to moderators
      const moderatorUpdates = screen.getAllByText('Updated by moderator')
      expect(moderatorUpdates).toHaveLength(2)

      // Both Submitted stages appear in the timeline (oldest initial and newest current)
      const submittedBadges = screen.getAllByText('Submitted')
      expect(submittedBadges).toHaveLength(2)

      // The latest reverted event represents the Current Status
      expect(screen.getByText('Current Status')).toBeInTheDocument()
    })
  })
})
