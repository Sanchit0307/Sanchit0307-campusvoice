import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateStatusCounts,
  getStatusGroups,
  calculateCategoryCounts,
  calculateSubmissionTrends,
  aggregateIdeaMetrics,
  fetchModeratorAnalytics,
  filterAnalyticsIdeas,
  formatDateKey,
  DATE_RANGE_OPTIONS,
  STATUS_GROUP_MAPPINGS,
  IDEA_STATUSES,
  IDEA_CATEGORIES,
} from '../../src/services/analyticsService'
import * as firestore from 'firebase/firestore'
import * as ideasService from '../../src/services/ideasService'

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    collection: vi.fn((_db, col) => ({ path: col })),
    query: vi.fn((colRef, ..._constraints) => ({ path: colRef.path, isQuery: true })),
    orderBy: vi.fn((field, dir) => ({ field, dir })),
    getDocs: vi.fn(),
  }
})

vi.mock('../../src/services/ideasService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    checkIsModerator: vi.fn(),
  }
})

describe('analyticsService Suite — Issue #8', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('formatDateKey', () => {
    it('formats a valid Date object to YYYY-MM-DD', () => {
      const d = new Date(2026, 9, 15) // Oct 15, 2026
      expect(formatDateKey(d)).toBe('2026-10-15')
    })

    it('formats an epoch timestamp in milliseconds', () => {
      const d = new Date(2026, 0, 5) // Jan 5, 2026
      expect(formatDateKey(d.getTime())).toBe('2026-01-05')
    })

    it('returns empty string for null, undefined, or invalid date input', () => {
      expect(formatDateKey(null)).toBe('')
      expect(formatDateKey(undefined)).toBe('')
      expect(formatDateKey(NaN)).toBe('')
      expect(formatDateKey(new Date('invalid-date'))).toBe('')
    })
  })

  describe('STATUS_GROUP_MAPPINGS', () => {
    it('is frozen and defines exact status mapping categories', () => {
      expect(Object.isFrozen(STATUS_GROUP_MAPPINGS)).toBe(true)
      expect(STATUS_GROUP_MAPPINGS.PENDING_REVIEW).toEqual(['Submitted', 'Under Review'])
      expect(STATUS_GROUP_MAPPINGS.IN_PROGRESS).toEqual(['In Progress'])
      expect(STATUS_GROUP_MAPPINGS.ACCEPTED_OR_IMPLEMENTED).toEqual(['Accepted', 'Implemented'])
      expect(STATUS_GROUP_MAPPINGS.REJECTED).toEqual(['Rejected'])
    })
  })

  describe('calculateStatusCounts & Status Grouping', () => {
    it('initializes all canonical statuses to 0 for an empty dataset', () => {
      const counts = calculateStatusCounts([])
      for (const status of IDEA_STATUSES) {
        expect(counts[status]).toBe(0)
      }
      expect(counts.Other).toBe(0)
    })

    it('handles non-array and null input gracefully without throwing', () => {
      const countsNull = calculateStatusCounts(null)
      expect(countsNull.Submitted).toBe(0)
      expect(countsNull.Other).toBe(0)

      const countsUndefined = calculateStatusCounts(undefined)
      expect(countsUndefined.Submitted).toBe(0)
    })

    it('correctly tallies canonical statuses without double counting', () => {
      const sampleIdeas = [
        { id: '1', status: 'Submitted' },
        { id: '2', status: 'Submitted' },
        { id: '3', status: 'Under Review' },
        { id: '4', status: 'In Progress' },
        { id: '5', status: 'Accepted' },
        { id: '6', status: 'Accepted' },
        { id: '7', status: 'Implemented' },
        { id: '8', status: 'Rejected' },
      ]

      const counts = calculateStatusCounts(sampleIdeas)
      expect(counts.Submitted).toBe(2)
      expect(counts['Under Review']).toBe(1)
      expect(counts['In Progress']).toBe(1)
      expect(counts.Accepted).toBe(2)
      expect(counts.Implemented).toBe(1)
      expect(counts.Rejected).toBe(1)
      expect(counts.Other).toBe(0)
    })

    it('tallies missing, null, or unrecognized statuses into Other without crashing', () => {
      const sampleIdeas = [
        { id: '1', status: 'Submitted' },
        { id: '2', status: 'Draft' }, // legacy/unrecognized
        { id: '3', status: null },
        { id: '4' }, // missing status key
        null, // null element
      ]

      const counts = calculateStatusCounts(sampleIdeas)
      expect(counts.Submitted).toBe(1)
      expect(counts.Other).toBe(3) // Draft, null, missing
    })

    it('guarantees status groups do not double-count or omit ideas', () => {
      const sampleIdeas = [
        { id: '1', status: 'Submitted' },
        { id: '2', status: 'Under Review' },
        { id: '3', status: 'In Progress' },
        { id: '4', status: 'Accepted' },
        { id: '5', status: 'Implemented' },
        { id: '6', status: 'Rejected' },
        { id: '7', status: 'Archived' }, // Other
      ]

      const counts = calculateStatusCounts(sampleIdeas)
      const groups = getStatusGroups(counts)

      expect(groups.pendingReview).toBe(2) // Submitted + Under Review
      expect(groups.inProgress).toBe(1) // In Progress
      expect(groups.accepted).toBe(1) // Accepted
      expect(groups.implemented).toBe(1) // Implemented
      expect(groups.acceptedOrImplemented).toBe(2) // Accepted + Implemented
      expect(groups.rejected).toBe(1) // Rejected
      expect(groups.other).toBe(1) // Archived

      // Critical invariant: Total grouped must match total valid ideas exactly
      expect(groups.totalGrouped).toBe(sampleIdeas.length)
      expect(
        groups.pendingReview +
          groups.inProgress +
          groups.acceptedOrImplemented +
          groups.rejected +
          groups.other
      ).toBe(sampleIdeas.length)
    })
  })

  describe('calculateCategoryCounts', () => {
    it('initializes all canonical categories to 0 for an empty dataset', () => {
      const counts = calculateCategoryCounts([])
      for (const cat of IDEA_CATEGORIES) {
        expect(counts[cat]).toBe(0)
      }
      expect(counts.Other).toBe(0)
    })

    it('accurately counts ideas by valid category', () => {
      const ideas = [
        { id: '1', category: 'Facilities' },
        { id: '2', category: 'Sustainability' },
        { id: '3', category: 'Facilities' },
        { id: '4', category: 'Dining' },
        { id: '5', category: 'Academics' },
      ]

      const counts = calculateCategoryCounts(ideas)
      expect(counts.Facilities).toBe(2)
      expect(counts.Sustainability).toBe(1)
      expect(counts.Dining).toBe(1)
      expect(counts.Academics).toBe(1)
      expect(counts['Campus Life']).toBe(0)
      expect(counts.Transportation).toBe(0)
      expect(counts.Wellness).toBe(0)
      expect(counts.Other).toBe(0)
    })

    it('aggregates invalid, missing, or unrecognized categories into Other', () => {
      const ideas = [
        { id: '1', category: 'Wellness' },
        { id: '2', category: 'UnknownCategory' },
        { id: '3', category: null },
        { id: '4' }, // missing category
      ]

      const counts = calculateCategoryCounts(ideas)
      expect(counts.Wellness).toBe(1)
      expect(counts.Other).toBe(3)
    })
  })

  describe('calculateSubmissionTrends', () => {
    it('returns an empty array for an empty or invalid dataset', () => {
      expect(calculateSubmissionTrends([])).toEqual([])
      expect(calculateSubmissionTrends(null)).toEqual([])
      expect(calculateSubmissionTrends(undefined)).toEqual([])
    })

    it('groups ideas by date and sorts chronologically', () => {
      const ideas = [
        { id: '1', createdAtRaw: new Date(2026, 9, 12, 10, 0) },
        { id: '2', createdAtRaw: new Date(2026, 9, 10, 14, 0) },
        { id: '3', createdAtRaw: new Date(2026, 9, 12, 18, 0) },
        { id: '4', createdAtRaw: new Date(2026, 9, 11, 9, 0) },
      ]

      const trends = calculateSubmissionTrends(ideas)
      expect(trends).toEqual([
        { date: '2026-10-10', count: 1 },
        { date: '2026-10-11', count: 1 },
        { date: '2026-10-12', count: 2 },
      ])
    })

    it('handles various timestamp representations (Firestore Timestamp, serialized, string, Date)', () => {
      const ideas = [
        // Firestore timestamp object with toDate()
        { id: '1', createdAtRaw: { toDate: () => new Date(2026, 9, 5) } },
        // Serialized Firestore timestamp { seconds, nanoseconds }
        { id: '2', createdAtRaw: { seconds: Math.floor(new Date(2026, 9, 5).getTime() / 1000), nanoseconds: 0 } },
        // Direct Date instance
        { id: '3', createdAtRaw: new Date(2026, 9, 6) },
        // ISO string
        { id: '4', createdAt: '2026-10-06T12:00:00Z' },
      ]

      const trends = calculateSubmissionTrends(ideas)
      expect(trends.length).toBe(2)
      expect(trends.find((t) => t.date === '2026-10-05')?.count).toBe(2)
      expect(trends.find((t) => t.date === '2026-10-06')?.count).toBe(2)
    })

    it('safely skips ideas with invalid, missing, or corrupted timestamps without crashing', () => {
      const ideas = [
        { id: '1', createdAtRaw: new Date(2026, 9, 1) },
        { id: '2', createdAtRaw: null, createdAt: null },
        { id: '3', createdAtRaw: 'not-a-valid-date' },
        { id: '4', createdAtRaw: { toDate: () => { throw new Error('Corrupt') } } },
      ]

      const trends = calculateSubmissionTrends(ideas)
      expect(trends).toEqual([{ date: '2026-10-01', count: 1 }])
    })

    it('applies date boundaries (startDate and endDate) correctly', () => {
      const ideas = [
        { id: '1', createdAtRaw: new Date(2026, 9, 1) },
        { id: '2', createdAtRaw: new Date(2026, 9, 5) },
        { id: '3', createdAtRaw: new Date(2026, 9, 10) },
        { id: '4', createdAtRaw: new Date(2026, 9, 15) },
      ]

      const startDate = new Date(2026, 9, 4)
      const endDate = new Date(2026, 9, 12)

      const trends = calculateSubmissionTrends(ideas, { startDate, endDate })
      expect(trends).toEqual([
        { date: '2026-10-05', count: 1 },
        { date: '2026-10-10', count: 1 },
      ])
    })
  })

  describe('aggregateIdeaMetrics', () => {
    it('returns zeroed metrics for an empty ideas list without throwing or returning NaN', () => {
      const metrics = aggregateIdeaMetrics([])

      expect(metrics.totalIdeas).toBe(0)
      expect(metrics.totalVotes).toBe(0)
      expect(metrics.averageVotesPerIdea).toBe(0)
      expect(metrics.submissionTrends).toEqual([])
      expect(metrics.statusGroups.totalGrouped).toBe(0)
      expect(metrics.statusGroups.pendingReview).toBe(0)
      expect(metrics.categoryCounts.Facilities).toBe(0)
    })

    it('aggregates totals, votes, averages, statuses, categories, and trends', () => {
      const sampleIdeas = [
        {
          id: '1',
          title: 'Idea 1',
          status: 'Submitted',
          category: 'Facilities',
          upvoteCount: 10,
          createdAtRaw: new Date(2026, 9, 1),
        },
        {
          id: '2',
          title: 'Idea 2',
          status: 'Under Review',
          category: 'Dining',
          upvotes: 20,
          createdAtRaw: new Date(2026, 9, 1),
        },
        {
          id: '3',
          title: 'Idea 3',
          status: 'Accepted',
          category: 'Facilities',
          upvoteCount: 30,
          createdAtRaw: new Date(2026, 9, 2),
        },
      ]

      const metrics = aggregateIdeaMetrics(sampleIdeas)

      expect(metrics.totalIdeas).toBe(3)
      expect(metrics.totalVotes).toBe(60)
      expect(metrics.averageVotesPerIdea).toBe(20)
      expect(metrics.statusGroups.pendingReview).toBe(2)
      expect(metrics.statusGroups.acceptedOrImplemented).toBe(1)
      expect(metrics.categoryCounts.Facilities).toBe(2)
      expect(metrics.categoryCounts.Dining).toBe(1)
      expect(metrics.submissionTrends).toEqual([
        { date: '2026-10-01', count: 2 },
        { date: '2026-10-02', count: 1 },
      ])
    })

    it('handles negative or invalid votes gracefully', () => {
      const sampleIdeas = [
        { id: '1', upvoteCount: -5 },
        { id: '2', upvoteCount: 'invalid' },
        { id: '3', upvoteCount: 10 },
      ]

      const metrics = aggregateIdeaMetrics(sampleIdeas)
      expect(metrics.totalVotes).toBe(10)
      expect(metrics.averageVotesPerIdea).toBe(3.3)
    })
  })

  describe('fetchModeratorAnalytics — Authorization and Query Execution', () => {
    it('throws unauthenticated error when user is not provided', async () => {
      await expect(fetchModeratorAnalytics(null)).rejects.toThrow('Authentication required')
      await expect(fetchModeratorAnalytics('')).rejects.toThrow('Authentication required')
      await expect(fetchModeratorAnalytics({ uid: '' })).rejects.toThrow('Authentication required')
    })

    it('denies access when user is not an authorized moderator', async () => {
      ideasService.checkIsModerator.mockResolvedValueOnce(false)

      await expect(fetchModeratorAnalytics('student_user_123')).rejects.toThrow(
        'Permission denied: Only authorized moderators can access analytics data.'
      )
      expect(ideasService.checkIsModerator).toHaveBeenCalledWith('student_user_123')
      expect(firestore.getDocs).not.toHaveBeenCalled()
    })

    it('succeeds for authorized moderator and fetches ideas without secondary subcollection reads', async () => {
      ideasService.checkIsModerator.mockResolvedValueOnce(true)

      const mockDocSnaps = [
        {
          id: 'idea-1',
          exists: () => true,
          data: () => ({
            title: 'Solar Panels in Quad',
            status: 'Submitted',
            category: 'Sustainability',
            upvoteCount: 15,
            createdAt: { toDate: () => new Date(2026, 9, 8) },
          }),
        },
        {
          id: 'idea-2',
          exists: () => true,
          data: () => ({
            title: 'Dining Hall Vegan Bar',
            status: 'Accepted',
            category: 'Dining',
            upvoteCount: 25,
            createdAt: { toDate: () => new Date(2026, 9, 9) },
          }),
        },
      ]

      firestore.getDocs.mockResolvedValueOnce({ docs: mockDocSnaps })

      const result = await fetchModeratorAnalytics({ uid: 'mod_123' })

      expect(ideasService.checkIsModerator).toHaveBeenCalledWith('mod_123')
      expect(firestore.getDocs).toHaveBeenCalled()
      expect(result.ideas.length).toBe(2)
      expect(result.metrics.totalIdeas).toBe(2)
      expect(result.metrics.statusCounts.Submitted).toBe(1)
      expect(result.metrics.statusCounts.Accepted).toBe(1)
      expect(result.metrics.categoryCounts.Sustainability).toBe(1)
      expect(result.metrics.categoryCounts.Dining).toBe(1)
      expect(result.metrics.totalVotes).toBe(40)
      expect(result.fetchedAt instanceof Date).toBe(true)
    })

    it('falls back to unindexed query if orderBy requires index building', async () => {
      ideasService.checkIsModerator.mockResolvedValueOnce(true)

      const indexError = new Error('Requires an index')
      indexError.code = 'failed-precondition'

      const mockDocSnaps = [
        {
          id: 'idea-1',
          exists: () => true,
          data: () => ({
            title: 'Idea 1',
            status: 'In Progress',
            category: 'Academics',
            upvoteCount: 5,
            createdAt: { toDate: () => new Date(2026, 9, 10) },
          }),
        },
      ]

      firestore.getDocs
        .mockRejectedValueOnce(indexError)
        .mockResolvedValueOnce({ docs: mockDocSnaps })

      const result = await fetchModeratorAnalytics('mod_456')

      expect(result.ideas.length).toBe(1)
      expect(result.metrics.totalIdeas).toBe(1)
      expect(result.metrics.statusCounts['In Progress']).toBe(1)
    })

    it('propagates Firestore error when unindexed fallback also fails', async () => {
      ideasService.checkIsModerator.mockResolvedValueOnce(true)

      const networkError = new Error('Network timeout')
      networkError.code = 'unavailable'

      firestore.getDocs.mockRejectedValueOnce(networkError)

      await expect(fetchModeratorAnalytics('mod_789')).rejects.toThrow(
        'Failed to load ideas for analytics: Network timeout'
      )
    })
  })

  describe('filterAnalyticsIdeas & DATE_RANGE_OPTIONS (Issue #10)', () => {
    it('provides frozen DATE_RANGE_OPTIONS with expected presets', () => {
      expect(Object.isFrozen(DATE_RANGE_OPTIONS)).toBe(true)
      expect(DATE_RANGE_OPTIONS.map((o) => o.id)).toEqual(['all', '7d', '30d', '90d', 'custom'])
    })

    const referenceNow = new Date(2026, 9, 20, 12, 0, 0) // Oct 20, 2026
    const sampleIdeas = [
      { id: '1', category: 'Facilities', createdAtRaw: new Date(2026, 9, 18) }, // 2 days ago
      { id: '2', category: 'Dining', createdAtRaw: new Date(2026, 9, 15) }, // 5 days ago
      { id: '3', category: 'Facilities', createdAtRaw: new Date(2026, 9, 5) }, // 15 days ago
      { id: '4', category: 'Academics', createdAtRaw: new Date(2026, 8, 1) }, // ~50 days ago
      { id: '5', category: 'Wellness', createdAtRaw: new Date(2026, 6, 1) }, // ~110 days ago
      { id: '6', category: 'Facilities', createdAtRaw: null }, // missing date
    ]

    it('returns empty array when input ideas is null or empty', () => {
      expect(filterAnalyticsIdeas([], {}, referenceNow)).toEqual([])
      expect(filterAnalyticsIdeas(null, {}, referenceNow)).toEqual([])
    })

    it('returns all ideas when default filters are passed (all time, all categories)', () => {
      const result = filterAnalyticsIdeas(sampleIdeas, { dateRange: 'all', category: 'All' }, referenceNow)
      expect(result.length).toBe(sampleIdeas.length)
    })

    it('filters strictly by category', () => {
      const result = filterAnalyticsIdeas(sampleIdeas, { category: 'Facilities' }, referenceNow)
      expect(result.map((i) => i.id)).toEqual(['1', '3', '6'])
    })

    it('filters ideas by 7d date preset', () => {
      const result = filterAnalyticsIdeas(sampleIdeas, { dateRange: '7d' }, referenceNow)
      // Oct 18 and Oct 15 are within last 7 days of Oct 20
      expect(result.map((i) => i.id)).toEqual(['1', '2'])
    })

    it('filters ideas by 30d date preset', () => {
      const result = filterAnalyticsIdeas(sampleIdeas, { dateRange: '30d' }, referenceNow)
      // Oct 18, Oct 15, and Oct 5 are within last 30 days
      expect(result.map((i) => i.id)).toEqual(['1', '2', '3'])
    })

    it('filters ideas by 90d date preset', () => {
      const result = filterAnalyticsIdeas(sampleIdeas, { dateRange: '90d' }, referenceNow)
      // 1, 2, 3, 4 are within last 90 days; 5 (July) is > 90 days; 6 has no date
      expect(result.map((i) => i.id)).toEqual(['1', '2', '3', '4'])
    })

    it('filters ideas by custom start and end date boundaries including full start and end days', () => {
      const result = filterAnalyticsIdeas(
        sampleIdeas,
        {
          dateRange: 'custom',
          customStartDate: '2026-10-04',
          customEndDate: '2026-10-16',
        },
        referenceNow
      )
      // Should match Oct 5 and Oct 15
      expect(result.map((i) => i.id)).toEqual(['2', '3'])
    })

    it('filters ideas by combined category and date range simultaneously', () => {
      const result = filterAnalyticsIdeas(
        sampleIdeas,
        {
          category: 'Facilities',
          dateRange: '7d',
        },
        referenceNow
      )
      // Facilities within 7d: only idea-1
      expect(result.map((i) => i.id)).toEqual(['1'])
    })
  })
})
