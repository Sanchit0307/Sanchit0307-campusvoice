import { describe, it, expect } from 'vitest'
import {
  formatIdeaTimestamp,
  normalizeIdeaDoc,
  IDEA_STATUSES,
} from '../../src/services/ideasService'

describe('ideasService Pure Helper Functions Suite', () => {
  describe('IDEA_STATUSES', () => {
    it('contains the 6 canonical workflow statuses in expected sequence', () => {
      expect(IDEA_STATUSES).toEqual([
        'Submitted',
        'Under Review',
        'In Progress',
        'Accepted',
        'Implemented',
        'Rejected',
      ])
    })

    it('is frozen to prevent runtime mutations', () => {
      expect(Object.isFrozen(IDEA_STATUSES)).toBe(true)
    })
  })

  describe('formatIdeaTimestamp', () => {
    it('returns "Just now" when timestamp is null, undefined, or empty', () => {
      expect(formatIdeaTimestamp(null)).toBe('Just now')
      expect(formatIdeaTimestamp(undefined)).toBe('Just now')
      expect(formatIdeaTimestamp('')).toBe('Just now')
    })

    it('formats a standard JavaScript Date instance', () => {
      // Use local date values to avoid timezone shifts
      const date = new Date(2026, 9, 9) // Oct 9, 2026
      const formatted = formatIdeaTimestamp(date)
      expect(formatted).toBe('Oct 9, 2026')
    })

    it('formats a Firestore Timestamp object with toDate()', () => {
      const mockTimestamp = {
        toDate: () => new Date(2026, 9, 9),
      }
      expect(formatIdeaTimestamp(mockTimestamp)).toBe('Oct 9, 2026')
    })

    it('formats a serialized Firestore timestamp object { seconds, nanoseconds }', () => {
      // 1791504000 = ~2026-10-09 UTC
      const serialized = {
        seconds: Math.floor(new Date(2026, 9, 9).getTime() / 1000),
        nanoseconds: 0,
      }
      expect(formatIdeaTimestamp(serialized)).toBe('Oct 9, 2026')
    })

    it('returns string representations directly without altering them', () => {
      expect(formatIdeaTimestamp('2 days ago')).toBe('2 days ago')
      expect(formatIdeaTimestamp('Just now')).toBe('Just now')
      expect(formatIdeaTimestamp('Oct 9, 2026')).toBe('Oct 9, 2026')
    })

    it('returns "Recently" when toDate() throws an unexpected error', () => {
      const brokenTimestamp = {
        toDate: () => {
          throw new Error('Corrupt timestamp')
        },
      }
      expect(formatIdeaTimestamp(brokenTimestamp)).toBe('Recently')
    })

    it('returns "Recently" when passed an invalid Date instance', () => {
      const invalidDate = new Date('invalid-date-string')
      expect(formatIdeaTimestamp(invalidDate)).toBe('Recently')
    })
  })

  describe('normalizeIdeaDoc', () => {
    it('returns null when snapshot is null or undefined', () => {
      expect(normalizeIdeaDoc(null)).toBeNull()
      expect(normalizeIdeaDoc(undefined)).toBeNull()
    })

    it('returns null when snapshot exists() method returns false', () => {
      const nonExistentDoc = {
        id: 'missing-id',
        exists: () => false,
        data: () => null,
      }
      expect(normalizeIdeaDoc(nonExistentDoc)).toBeNull()
    })

    it('normalizes a complete Firestore document snapshot into an Idea model', () => {
      const docSnap = {
        id: 'idea-101',
        exists: () => true,
        data: () => ({
          title: 'Campus Garden Initiative',
          description: 'Establish community garden plots outside science hall.',
          category: 'Sustainability',
          authorId: 'user_456',
          authorName: 'Jordan Student',
          status: 'Under Review',
          upvoteCount: 23,
          createdAt: new Date(2026, 9, 9),
          updatedAt: new Date(2026, 9, 10),
        }),
      }

      const normalized = normalizeIdeaDoc(docSnap)
      expect(normalized).toEqual({
        id: 'idea-101',
        title: 'Campus Garden Initiative',
        description: 'Establish community garden plots outside science hall.',
        category: 'Sustainability',
        authorId: 'user_456',
        authorName: 'Jordan Student',
        status: 'Under Review',
        upvoteCount: 23,
        upvotes: 23,
        hasUpvoted: false,
        createdAt: 'Oct 9, 2026',
        createdAtRaw: expect.any(Date),
        updatedAt: 'Oct 10, 2026',
        updatedAtRaw: expect.any(Date),
      })
    })

    it('defaults missing optional fields gracefully', () => {
      const docSnap = {
        id: 'idea-minimal',
        exists: () => true,
        data: () => ({
          title: 'Minimal Idea',
          description: 'Minimal description text.',
        }),
      }

      const normalized = normalizeIdeaDoc(docSnap)
      expect(normalized.category).toBe('General')
      expect(normalized.authorName).toBe('Anonymous Student')
      expect(normalized.authorId).toBeNull()
      expect(normalized.status).toBe('Submitted')
      expect(normalized.upvoteCount).toBe(0)
      expect(normalized.upvotes).toBe(0)
      expect(normalized.hasUpvoted).toBe(false)
      expect(normalized.createdAt).toBe('Just now')
      expect(normalized.updatedAt).toBe('Just now')
    })

    it('falls back to legacy upvotes field when upvoteCount is not provided', () => {
      const docSnap = {
        id: 'legacy-doc',
        exists: () => true,
        data: () => ({
          title: 'Legacy Proposal',
          description: 'Uses legacy upvotes field.',
          upvotes: 35,
        }),
      }

      const normalized = normalizeIdeaDoc(docSnap)
      expect(normalized.upvoteCount).toBe(35)
      expect(normalized.upvotes).toBe(35)
    })

    it('handles empty document data gracefully without throwing', () => {
      const emptyDocSnap = {
        id: 'empty-doc',
        exists: () => true,
        data: () => null,
      }

      const normalized = normalizeIdeaDoc(emptyDocSnap)
      expect(normalized.id).toBe('empty-doc')
      expect(normalized.title).toBe('')
      expect(normalized.authorName).toBe('Anonymous Student')
      expect(normalized.status).toBe('Submitted')
      expect(normalized.upvoteCount).toBe(0)
    })
  })
})
