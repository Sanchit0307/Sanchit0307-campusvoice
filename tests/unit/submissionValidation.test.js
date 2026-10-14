import { describe, it, expect } from 'vitest'
import {
  validateIdeaSubmission,
  getCounterClass,
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESC_MIN_LENGTH,
  DESC_MAX_LENGTH,
} from '../../src/utils/validation'
import { IDEA_CATEGORIES } from '../../src/data/mockIdeas'

describe('Submission Validation Suite', () => {
  const validPayload = {
    title: 'Install Outdoor Shade Canopies in North Quad',
    category: 'Facilities',
    description: 'Provide weather-resistant shade sails and seating in the north courtyard to allow studying outdoors.',
  }

  describe('validateIdeaSubmission - Title Validation', () => {
    it('rejects missing or empty title', () => {
      const errors = validateIdeaSubmission({ ...validPayload, title: '' })
      expect(errors.title).toBe('Please enter an idea title.')
    })

    it('rejects whitespace-only title', () => {
      const errors = validateIdeaSubmission({ ...validPayload, title: '    ' })
      expect(errors.title).toBe('Please enter an idea title.')
    })

    it(`rejects title shorter than ${TITLE_MIN_LENGTH} characters`, () => {
      const errors = validateIdeaSubmission({ ...validPayload, title: 'Chat' }) // 4 characters
      expect(errors.title).toBe(`Title must be at least ${TITLE_MIN_LENGTH} characters.`)
    })

    it(`accepts title with exactly ${TITLE_MIN_LENGTH} characters`, () => {
      const errors = validateIdeaSubmission({ ...validPayload, title: 'Study' }) // 5 characters
      expect(errors.title).toBeUndefined()
    })

    it(`accepts title with exactly ${TITLE_MAX_LENGTH} characters`, () => {
      const exactly100Chars = 'A'.repeat(TITLE_MAX_LENGTH)
      const errors = validateIdeaSubmission({ ...validPayload, title: exactly100Chars })
      expect(errors.title).toBeUndefined()
    })

    it(`rejects title longer than ${TITLE_MAX_LENGTH} characters`, () => {
      const over100Chars = 'A'.repeat(TITLE_MAX_LENGTH + 1)
      const errors = validateIdeaSubmission({ ...validPayload, title: over100Chars })
      expect(errors.title).toBe(`Title cannot exceed ${TITLE_MAX_LENGTH} characters.`)
    })

    it('trims leading and trailing whitespace before evaluating title length', () => {
      // '  Study  ' has length 9 with whitespace, but 5 when trimmed
      const errors = validateIdeaSubmission({ ...validPayload, title: '  Study  ' })
      expect(errors.title).toBeUndefined()

      // '  Four  ' has length 8 with whitespace, but 4 when trimmed
      const tooShortErrors = validateIdeaSubmission({ ...validPayload, title: '  Four  ' })
      expect(tooShortErrors.title).toBe(`Title must be at least ${TITLE_MIN_LENGTH} characters.`)
    })
  })

  describe('validateIdeaSubmission - Category Validation', () => {
    it('rejects empty or unselected category', () => {
      const errors = validateIdeaSubmission({ ...validPayload, category: '' })
      expect(errors.category).toBe('Please select a category for your idea.')
    })

    it('rejects invalid category when validCategories list is provided', () => {
      const errors = validateIdeaSubmission(
        { ...validPayload, category: 'SpaceExploration' },
        IDEA_CATEGORIES
      )
      expect(errors.category).toBe('Please select a valid category from the available options.')
    })

    it('accepts any valid category from IDEA_CATEGORIES', () => {
      for (const cat of IDEA_CATEGORIES) {
        const errors = validateIdeaSubmission(
          { ...validPayload, category: cat },
          IDEA_CATEGORIES
        )
        expect(errors.category).toBeUndefined()
      }
    })

    it('accepts non-empty category when validCategories list is omitted', () => {
      const errors = validateIdeaSubmission({ ...validPayload, category: 'CustomCategory' })
      expect(errors.category).toBeUndefined()
    })
  })

  describe('validateIdeaSubmission - Description Validation', () => {
    it('rejects missing or empty description', () => {
      const errors = validateIdeaSubmission({ ...validPayload, description: '' })
      expect(errors.description).toBe('Please provide a description of your proposal.')
    })

    it('rejects whitespace-only description', () => {
      const errors = validateIdeaSubmission({ ...validPayload, description: '   \n  \t   ' })
      expect(errors.description).toBe('Please provide a description of your proposal.')
    })

    it(`rejects description shorter than ${DESC_MIN_LENGTH} characters`, () => {
      const shortText = 'Short description.' // 18 characters
      const errors = validateIdeaSubmission({ ...validPayload, description: shortText })
      expect(errors.description).toBe(
        `Description must be at least ${DESC_MIN_LENGTH} characters to explain your proposal.`
      )
    })

    it(`accepts description with exactly ${DESC_MIN_LENGTH} characters`, () => {
      const exactly20Chars = '12345678901234567890' // 20 characters
      const errors = validateIdeaSubmission({ ...validPayload, description: exactly20Chars })
      expect(errors.description).toBeUndefined()
    })

    it(`accepts description with exactly ${DESC_MAX_LENGTH} characters`, () => {
      const exactly500Chars = 'X'.repeat(DESC_MAX_LENGTH)
      const errors = validateIdeaSubmission({ ...validPayload, description: exactly500Chars })
      expect(errors.description).toBeUndefined()
    })

    it(`rejects description longer than ${DESC_MAX_LENGTH} characters`, () => {
      const over500Chars = 'X'.repeat(DESC_MAX_LENGTH + 1)
      const errors = validateIdeaSubmission({ ...validPayload, description: over500Chars })
      expect(errors.description).toBe(`Description cannot exceed ${DESC_MAX_LENGTH} characters.`)
    })

    it('trims leading and trailing whitespace before evaluating description length', () => {
      // 19 chars when trimmed, even if 25 with spaces
      const errors = validateIdeaSubmission({
        ...validPayload,
        description: '   1234567890123456789   ',
      })
      expect(errors.description).toBe(
        `Description must be at least ${DESC_MIN_LENGTH} characters to explain your proposal.`
      )
    })
  })

  describe('validateIdeaSubmission - Complete Valid Submissions', () => {
    it('returns empty error object when all fields are completely valid', () => {
      const errors = validateIdeaSubmission(validPayload, IDEA_CATEGORIES)
      expect(errors).toEqual({})
      expect(Object.keys(errors)).toHaveLength(0)
    })

    it('handles null or undefined formData gracefully without throwing', () => {
      const errorsNull = validateIdeaSubmission(null)
      expect(errorsNull.title).toBe('Please enter an idea title.')
      expect(errorsNull.category).toBe('Please select a category for your idea.')
      expect(errorsNull.description).toBe('Please provide a description of your proposal.')

      const errorsUndefined = validateIdeaSubmission(undefined)
      expect(errorsUndefined.title).toBe('Please enter an idea title.')
    })
  })

  describe('getCounterClass - Character Counter Thresholds', () => {
    it('returns empty string when currentLength is below 85% of maxLength', () => {
      expect(getCounterClass(50, 100)).toBe('')
      expect(getCounterClass(84, 100)).toBe('')
      expect(getCounterClass(0, 100)).toBe('')
    })

    it('returns "counter-warning" when currentLength is at or above 85% but below 100%', () => {
      expect(getCounterClass(85, 100)).toBe('counter-warning')
      expect(getCounterClass(95, 100)).toBe('counter-warning')
      expect(getCounterClass(99, 100)).toBe('counter-warning')
    })

    it('returns "counter-max" when currentLength reaches or exceeds 100%', () => {
      expect(getCounterClass(100, 100)).toBe('counter-max')
      expect(getCounterClass(105, 100)).toBe('counter-max')
    })
  })
})
