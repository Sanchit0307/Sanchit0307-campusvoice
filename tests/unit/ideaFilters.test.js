import { describe, it, expect } from 'vitest'
import {
  filterAndSortIdeas,
  getIdeaTimestampValue,
  getIdeaVoteCount,
} from '../../src/utils/ideaFilters'

describe('ideaFilters Utility Suite', () => {
  const sampleIdeas = [
    {
      id: 'idea-1',
      title: 'Solar Panels on Student Union Roof',
      description: 'Install high-efficiency solar panels on the campus student union roof.',
      category: 'Sustainability',
      status: 'Under Review',
      upvoteCount: 15,
      createdAtRaw: { seconds: 1700000100, nanoseconds: 0 },
    },
    {
      id: 'idea-2',
      title: '24/7 Library Study Lounge Access',
      description: 'Provide 24/7 keycard access to the central campus library study rooms.',
      category: 'Facilities',
      status: 'Submitted',
      upvoteCount: 42,
      createdAtRaw: { seconds: 1700000300, nanoseconds: 0 },
    },
    {
      id: 'idea-3',
      title: 'Campus Dining Vegan Station Expansion',
      description: 'Add more plant-based meal choices to the central dining hall menu.',
      category: 'Dining',
      status: 'In Progress',
      upvoteCount: 42,
      createdAtRaw: { seconds: 1700000200, nanoseconds: 0 },
    },
    {
      id: 'idea-4',
      title: 'Weekend Late-Night Campus Shuttle',
      description: 'Safe transportation options between dorms and library during finals week.',
      category: 'Transportation',
      status: 'Accepted',
      upvoteCount: 8,
      createdAtRaw: { seconds: 1700000050, nanoseconds: 0 },
    },
  ]

  describe('getIdeaTimestampValue', () => {
    it('returns 0 when idea is null or undefined', () => {
      expect(getIdeaTimestampValue(null)).toBe(0)
      expect(getIdeaTimestampValue(undefined)).toBe(0)
    })

    it('extracts epoch milliseconds from Firestore Timestamp object with toMillis()', () => {
      const idea = {
        createdAtRaw: {
          toMillis: () => 1712345678000,
        },
      }
      expect(getIdeaTimestampValue(idea)).toBe(1712345678000)
    })

    it('extracts epoch milliseconds from Firestore Timestamp object with toDate()', () => {
      const fixedDate = new Date('2026-05-10T12:00:00Z')
      const idea = {
        createdAtRaw: {
          toDate: () => fixedDate,
        },
      }
      expect(getIdeaTimestampValue(idea)).toBe(fixedDate.getTime())
    })

    it('extracts epoch milliseconds from serialized timestamp { seconds, nanoseconds }', () => {
      const idea = {
        createdAtRaw: {
          seconds: 1700000000,
          nanoseconds: 500000000, // 500 ms
        },
      }
      expect(getIdeaTimestampValue(idea)).toBe(1700000000500)
    })

    it('extracts epoch milliseconds from JavaScript Date instance', () => {
      const date = new Date('2026-01-15T08:30:00Z')
      const idea = { createdAtRaw: date }
      expect(getIdeaTimestampValue(idea)).toBe(date.getTime())
    })

    it('extracts epoch milliseconds from numeric timestamp', () => {
      const idea = { createdAtRaw: 1699999999000 }
      expect(getIdeaTimestampValue(idea)).toBe(1699999999000)
    })

    it('parses valid ISO string in createdAtRaw', () => {
      const iso = '2026-03-20T10:00:00.000Z'
      const idea = { createdAtRaw: iso }
      expect(getIdeaTimestampValue(idea)).toBe(Date.parse(iso))
    })

    it('falls back to idea.createdAt when createdAtRaw is missing or invalid', () => {
      const ideaWithDate = { createdAt: new Date('2026-06-01T00:00:00Z') }
      expect(getIdeaTimestampValue(ideaWithDate)).toBe(ideaWithDate.createdAt.getTime())

      const ideaWithString = { createdAt: '2026-07-04T12:00:00Z' }
      expect(getIdeaTimestampValue(ideaWithString)).toBe(Date.parse('2026-07-04T12:00:00Z'))
    })

    it('returns 0 when both createdAtRaw and createdAt are unparseable or missing', () => {
      expect(getIdeaTimestampValue({})).toBe(0)
      expect(getIdeaTimestampValue({ createdAtRaw: 'not-a-valid-date' })).toBe(0)
      expect(getIdeaTimestampValue({ createdAt: 'invalid-date-string' })).toBe(0)
    })
  })

  describe('getIdeaVoteCount', () => {
    it('returns 0 when idea is null or undefined', () => {
      expect(getIdeaVoteCount(null)).toBe(0)
      expect(getIdeaVoteCount(undefined)).toBe(0)
    })

    it('returns upvoteCount when present and numeric', () => {
      expect(getIdeaVoteCount({ upvoteCount: 25 })).toBe(25)
      expect(getIdeaVoteCount({ upvoteCount: 0 })).toBe(0)
    })

    it('falls back to legacy upvotes field when upvoteCount is missing', () => {
      expect(getIdeaVoteCount({ upvotes: 18 })).toBe(18)
    })

    it('returns 0 when neither upvoteCount nor upvotes is a valid number', () => {
      expect(getIdeaVoteCount({})).toBe(0)
      expect(getIdeaVoteCount({ upvoteCount: null, upvotes: undefined })).toBe(0)
      expect(getIdeaVoteCount({ upvoteCount: NaN, upvotes: 'twenty' })).toBe(0)
    })
  })

  describe('filterAndSortIdeas - Search Filtering', () => {
    it('filters ideas matching title case-insensitively', () => {
      const results = filterAndSortIdeas(sampleIdeas, { searchQuery: 'solar' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('idea-1')
    })

    it('filters ideas matching description case-insensitively', () => {
      const results = filterAndSortIdeas(sampleIdeas, { searchQuery: 'plant-based' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('idea-3')
    })

    it('trims leading and trailing whitespace from query', () => {
      const results = filterAndSortIdeas(sampleIdeas, { searchQuery: '   shuttle   ' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('idea-4')
    })

    it('returns all ideas when search query is empty or whitespace-only', () => {
      expect(filterAndSortIdeas(sampleIdeas, { searchQuery: '' })).toHaveLength(4)
      expect(filterAndSortIdeas(sampleIdeas, { searchQuery: '   ' })).toHaveLength(4)
    })

    it('returns empty array when search query matches neither title nor description', () => {
      const results = filterAndSortIdeas(sampleIdeas, { searchQuery: 'nonexistent topic xyz' })
      expect(results).toEqual([])
    })
  })

  describe('filterAndSortIdeas - Category & Status Filtering', () => {
    it('filters ideas by specific category', () => {
      const results = filterAndSortIdeas(sampleIdeas, { selectedCategory: 'Sustainability' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('idea-1')
    })

    it('includes all categories when selectedCategory is "All"', () => {
      const results = filterAndSortIdeas(sampleIdeas, { selectedCategory: 'All' })
      expect(results).toHaveLength(4)
    })

    it('filters ideas by specific status', () => {
      const results = filterAndSortIdeas(sampleIdeas, { selectedStatus: 'Under Review' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('idea-1')
    })

    it('filters ideas with Rejected status correctly', () => {
      const ideasWithRejected = [
        ...sampleIdeas,
        {
          id: 'idea-rejected-1',
          title: 'Off-Campus Helicopter Shuttle',
          description: 'Provide luxury helicopter rides across campus quads.',
          category: 'Transportation',
          status: 'Rejected',
          upvoteCount: 3,
          createdAtRaw: { seconds: 1700000400, nanoseconds: 0 },
        },
      ]

      const rejectedResults = filterAndSortIdeas(ideasWithRejected, { selectedStatus: 'Rejected' })
      expect(rejectedResults).toHaveLength(1)
      expect(rejectedResults[0].id).toBe('idea-rejected-1')
      expect(rejectedResults[0].status).toBe('Rejected')
    })

    it('includes all statuses when selectedStatus is "All"', () => {
      const results = filterAndSortIdeas(sampleIdeas, { selectedStatus: 'All' })
      expect(results).toHaveLength(4)
    })

    it('applies combined search query, category, and status simultaneously', () => {
      const results = filterAndSortIdeas(sampleIdeas, {
        searchQuery: 'library',
        selectedCategory: 'Facilities',
        selectedStatus: 'Submitted',
      })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('idea-2')
    })

    it('returns empty array if search matches but status differs', () => {
      const results = filterAndSortIdeas(sampleIdeas, {
        searchQuery: 'library',
        selectedCategory: 'Facilities',
        selectedStatus: 'Implemented',
      })
      expect(results).toHaveLength(0)
    })
  })

  describe('filterAndSortIdeas - Sorting & Tie-breaking', () => {
    it('sorts by newest first by default', () => {
      const results = filterAndSortIdeas(sampleIdeas, { sortBy: 'newest' })
      // idea-2: 1700000300, idea-3: 1700000200, idea-1: 1700000100, idea-4: 1700000050
      expect(results.map((item) => item.id)).toEqual(['idea-2', 'idea-3', 'idea-1', 'idea-4'])
    })

    it('uses vote count as tie-breaker when newest timestamps are identical', () => {
      const tiedTimestampIdeas = [
        {
          id: 'tie-low-votes',
          title: 'Idea A',
          upvoteCount: 5,
          createdAtRaw: { seconds: 1700000000 },
        },
        {
          id: 'tie-high-votes',
          title: 'Idea B',
          upvoteCount: 50,
          createdAtRaw: { seconds: 1700000000 },
        },
      ]

      const results = filterAndSortIdeas(tiedTimestampIdeas, { sortBy: 'newest' })
      expect(results[0].id).toBe('tie-high-votes')
      expect(results[1].id).toBe('tie-low-votes')
    })

    it('sorts by upvotes descending when sortBy is "upvotes"', () => {
      const results = filterAndSortIdeas(sampleIdeas, { sortBy: 'upvotes' })
      // Highest votes: idea-2 (42, newest) then idea-3 (42, older) then idea-1 (15) then idea-4 (8)
      expect(results.map((item) => item.id)).toEqual(['idea-2', 'idea-3', 'idea-1', 'idea-4'])
    })

    it('uses newest timestamp as tie-breaker when vote counts are equal', () => {
      const tiedVotesIdeas = [
        {
          id: 'older-tie',
          title: 'Idea Old',
          upvoteCount: 20,
          createdAtRaw: { seconds: 100 },
        },
        {
          id: 'newer-tie',
          title: 'Idea New',
          upvoteCount: 20,
          createdAtRaw: { seconds: 200 },
        },
      ]

      const results = filterAndSortIdeas(tiedVotesIdeas, { sortBy: 'upvotes' })
      expect(results[0].id).toBe('newer-tie')
      expect(results[1].id).toBe('older-tie')
    })

    it('handles identical vote counts and timestamps without crashing', () => {
      const identicalIdeas = [
        { id: 'item-1', upvoteCount: 10, createdAtRaw: 100 },
        { id: 'item-2', upvoteCount: 10, createdAtRaw: 100 },
      ]
      const results = filterAndSortIdeas(identicalIdeas, { sortBy: 'upvotes' })
      expect(results).toHaveLength(2)
    })

    it('does not mutate the original ideas array', () => {
      const originalCopy = [...sampleIdeas]
      filterAndSortIdeas(sampleIdeas, { sortBy: 'upvotes' })
      expect(sampleIdeas).toEqual(originalCopy)
    })

    it('gracefully handles empty, null, or non-array inputs', () => {
      expect(filterAndSortIdeas([])).toEqual([])
      expect(filterAndSortIdeas(null)).toEqual([])
      expect(filterAndSortIdeas(undefined)).toEqual([])
      expect(filterAndSortIdeas('invalid')).toEqual([])
    })
  })
})
