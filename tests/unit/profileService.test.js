import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateProfileInput,
  getUserProfile,
  saveUserProfile,
  PROFILE_LIMITS,
  USERS_COLLECTION,
} from '../../src/services/profileService'
import * as firestoreModule from 'firebase/firestore'
import * as firebaseModule from '../../src/firebase/firebase'
import * as authModule from 'firebase/auth'

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
}))

vi.mock('../../src/firebase/firebase', () => ({
  db: { type: 'mock-firestore-db' },
  auth: { currentUser: { uid: 'student_123', email: 'student@campus.edu' } },
  isFirebaseConfigured: vi.fn(() => true),
}))

vi.mock('firebase/auth', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
}))

describe('profileService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(firebaseModule.isFirebaseConfigured).mockReturnValue(true)
  })

  describe('validateProfileInput', () => {
    it('returns isValid: true when all inputs satisfy constraints', () => {
      const result = validateProfileInput({
        displayName: 'Alex Morgan',
        bio: 'Passionate about campus recycling and sustainability.',
        department: 'Environmental Science',
        year: 'Junior (Class of 2027)',
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual({})
    })

    it('rejects empty or whitespace-only display name', () => {
      const result = validateProfileInput({ displayName: '   ' })
      expect(result.isValid).toBe(false)
      expect(result.errors.displayName).toMatch(/display name is required/i)
    })

    it('rejects display name shorter than minimum characters', () => {
      const result = validateProfileInput({ displayName: 'A' })
      expect(result.isValid).toBe(false)
      expect(result.errors.displayName).toContain(`at least ${PROFILE_LIMITS.DISPLAY_NAME_MIN}`)
    })

    it('rejects display name exceeding maximum characters', () => {
      const longName = 'A'.repeat(PROFILE_LIMITS.DISPLAY_NAME_MAX + 1)
      const result = validateProfileInput({ displayName: longName })
      expect(result.isValid).toBe(false)
      expect(result.errors.displayName).toContain(`cannot exceed ${PROFILE_LIMITS.DISPLAY_NAME_MAX}`)
    })

    it('rejects biography exceeding maximum length', () => {
      const longBio = 'B'.repeat(PROFILE_LIMITS.BIO_MAX + 1)
      const result = validateProfileInput({ displayName: 'Alex', bio: longBio })
      expect(result.isValid).toBe(false)
      expect(result.errors.bio).toContain(`cannot exceed ${PROFILE_LIMITS.BIO_MAX}`)
    })

    it('rejects department exceeding maximum length', () => {
      const longDept = 'D'.repeat(PROFILE_LIMITS.DEPARTMENT_MAX + 1)
      const result = validateProfileInput({ displayName: 'Alex', department: longDept })
      expect(result.isValid).toBe(false)
      expect(result.errors.department).toContain(`cannot exceed ${PROFILE_LIMITS.DEPARTMENT_MAX}`)
    })

    it('rejects academic year exceeding maximum length', () => {
      const longYear = 'Y'.repeat(PROFILE_LIMITS.YEAR_MAX + 1)
      const result = validateProfileInput({ displayName: 'Alex', year: longYear })
      expect(result.isValid).toBe(false)
      expect(result.errors.year).toContain(`cannot exceed ${PROFILE_LIMITS.YEAR_MAX}`)
    })
  })

  describe('getUserProfile', () => {
    it('returns null if userId is missing or invalid', async () => {
      expect(await getUserProfile('')).toBeNull()
      expect(await getUserProfile(null)).toBeNull()
      expect(await getUserProfile(undefined)).toBeNull()
    })

    it('returns null if firebase is not configured', async () => {
      vi.mocked(firebaseModule.isFirebaseConfigured).mockReturnValue(false)
      const result = await getUserProfile('user_1')
      expect(result).toBeNull()
    })

    it('gracefully returns null for legacy users without a profile document', async () => {
      vi.mocked(firestoreModule.getDoc).mockResolvedValueOnce({
        exists: () => false,
      })

      const result = await getUserProfile('legacy_user_123')
      expect(result).toBeNull()
      expect(firestoreModule.getDoc).toHaveBeenCalledTimes(1)
    })

    it('returns normalized profile data for existing profile documents', async () => {
      vi.mocked(firestoreModule.getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'student_123',
        data: () => ({
          displayName: 'Taylor Swift',
          email: 'taylor@campus.edu',
          bio: 'Writing ideas for campus concerts.',
          department: 'Music & Arts',
          year: 'Senior',
          createdAt: { seconds: 1700000000 },
          updatedAt: { seconds: 1700000100 },
        }),
      })

      const result = await getUserProfile('student_123')
      expect(result).toEqual({
        uid: 'student_123',
        displayName: 'Taylor Swift',
        email: 'taylor@campus.edu',
        bio: 'Writing ideas for campus concerts.',
        department: 'Music & Arts',
        year: 'Senior',
        createdAt: { seconds: 1700000000 },
        updatedAt: { seconds: 1700000100 },
      })
    })

    it('throws custom error when Firestore rejects read with permission-denied', async () => {
      const permError = new Error('Permission Denied')
      permError.code = 'permission-denied'
      vi.mocked(firestoreModule.getDoc).mockRejectedValueOnce(permError)

      await expect(getUserProfile('student_blocked')).rejects.toThrow(
        /permission denied accessing user profile/i
      )
    })
  })

  describe('saveUserProfile', () => {
    it('throws validation error if input is invalid before sending to Firestore', async () => {
      await expect(
        saveUserProfile('student_123', { displayName: '' })
      ).rejects.toThrow(/display name is required/i)

      expect(firestoreModule.setDoc).not.toHaveBeenCalled()
      expect(firestoreModule.updateDoc).not.toHaveBeenCalled()
    })

    it('creates a new profile document if none existed (legacy/new user creation)', async () => {
      vi.mocked(firestoreModule.getDoc).mockResolvedValueOnce({
        exists: () => false,
      })
      vi.mocked(firestoreModule.setDoc).mockResolvedValueOnce(undefined)

      const saved = await saveUserProfile(
        'student_new',
        {
          displayName: 'New Student',
          bio: 'First time proposing ideas.',
          department: 'Business Administration',
          year: 'Freshman',
        },
        { email: 'new@campus.edu' }
      )

      expect(firestoreModule.setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `${USERS_COLLECTION}/student_new` }),
        expect.objectContaining({
          uid: 'student_new',
          displayName: 'New Student',
          email: 'new@campus.edu',
          bio: 'First time proposing ideas.',
          department: 'Business Administration',
          year: 'Freshman',
          createdAt: expect.any(Object),
          updatedAt: expect.any(Object),
        })
      )
      expect(saved.displayName).toBe('New Student')
    })

    it('updates only permitted fields if profile document already exists', async () => {
      vi.mocked(firestoreModule.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: 'student_123',
          email: 'student@campus.edu',
        }),
      })
      vi.mocked(firestoreModule.updateDoc).mockResolvedValueOnce(undefined)

      const saved = await saveUserProfile('student_123', {
        displayName: 'Updated Name',
        bio: 'Updated bio information.',
        department: 'Physics',
        year: 'Sophomore',
      })

      expect(firestoreModule.updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `${USERS_COLLECTION}/student_123` }),
        {
          displayName: 'Updated Name',
          bio: 'Updated bio information.',
          department: 'Physics',
          year: 'Sophomore',
          updatedAt: expect.any(Object),
        }
      )
      expect(saved.displayName).toBe('Updated Name')
    })

    it('syncs displayName with Firebase Auth instance if currentUser matches', async () => {
      vi.mocked(firestoreModule.getDoc).mockResolvedValueOnce({
        exists: () => true,
      })
      vi.mocked(firestoreModule.updateDoc).mockResolvedValueOnce(undefined)

      await saveUserProfile('student_123', {
        displayName: 'Synced Name',
      })

      expect(authModule.updateProfile).toHaveBeenCalledWith(
        firebaseModule.auth.currentUser,
        { displayName: 'Synced Name' }
      )
    })

    it('translates permission-denied error from Firestore into readable error', async () => {
      vi.mocked(firestoreModule.getDoc).mockResolvedValueOnce({
        exists: () => true,
      })
      const permErr = new Error('Missing or insufficient permissions.')
      permErr.code = 'permission-denied'
      vi.mocked(firestoreModule.updateDoc).mockRejectedValueOnce(permErr)

      await expect(
        saveUserProfile('student_123', { displayName: 'Hacker' })
      ).rejects.toThrow(/permission denied/i)
    })

    it('throws error and does not treat failed getDoc read as missing profile', async () => {
      const readError = new Error('Network failure during getDoc read')
      vi.mocked(firestoreModule.getDoc).mockRejectedValueOnce(readError)

      await expect(
        saveUserProfile('student_123', {
          displayName: 'Alex Morgan',
          bio: 'Bio',
        })
      ).rejects.toThrow(/network failure during getdoc read/i)

      expect(firestoreModule.setDoc).not.toHaveBeenCalled()
      expect(firestoreModule.updateDoc).not.toHaveBeenCalled()
    })

    it('throws permission-denied error and prevents setDoc when getDoc read is denied', async () => {
      const permError = new Error('Missing or insufficient permissions.')
      permError.code = 'permission-denied'
      vi.mocked(firestoreModule.getDoc).mockRejectedValueOnce(permError)

      await expect(
        saveUserProfile('student_123', {
          displayName: 'Alex Morgan',
        })
      ).rejects.toThrow(/permission denied accessing user profile/i)

      expect(firestoreModule.setDoc).not.toHaveBeenCalled()
      expect(firestoreModule.updateDoc).not.toHaveBeenCalled()
    })
  })
})

