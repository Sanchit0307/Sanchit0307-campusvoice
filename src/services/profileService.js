import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { db, auth, isFirebaseConfigured } from '../firebase/firebase'

export const USERS_COLLECTION = 'users'

export const PROFILE_LIMITS = Object.freeze({
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 50,
  BIO_MAX: 250,
  DEPARTMENT_MAX: 100,
  YEAR_MAX: 30,
})

/**
 * Validates student profile form inputs against defined length and format constraints.
 *
 * @param {object} input - Profile input fields.
 * @param {string} [input.displayName] - Student's display name.
 * @param {string} [input.bio] - Short biography.
 * @param {string} [input.department] - Academic department or major.
 * @param {string} [input.year] - Academic year or graduation class.
 * @returns {{ isValid: boolean, errors: Record<string, string> }} Validation result and error map.
 */
export function validateProfileInput({ displayName, bio = '', department = '', year = '' }) {
  const errors = {}

  const trimmedName = typeof displayName === 'string' ? displayName.trim() : ''
  if (!trimmedName) {
    errors.displayName = 'Display name is required.'
  } else if (trimmedName.length < PROFILE_LIMITS.DISPLAY_NAME_MIN) {
    errors.displayName = `Display name must be at least ${PROFILE_LIMITS.DISPLAY_NAME_MIN} characters.`
  } else if (trimmedName.length > PROFILE_LIMITS.DISPLAY_NAME_MAX) {
    errors.displayName = `Display name cannot exceed ${PROFILE_LIMITS.DISPLAY_NAME_MAX} characters.`
  }

  const trimmedBio = typeof bio === 'string' ? bio.trim() : ''
  if (trimmedBio.length > PROFILE_LIMITS.BIO_MAX) {
    errors.bio = `Bio cannot exceed ${PROFILE_LIMITS.BIO_MAX} characters.`
  }

  const trimmedDept = typeof department === 'string' ? department.trim() : ''
  if (trimmedDept.length > PROFILE_LIMITS.DEPARTMENT_MAX) {
    errors.department = `Department cannot exceed ${PROFILE_LIMITS.DEPARTMENT_MAX} characters.`
  }

  const trimmedYear = typeof year === 'string' ? year.trim() : ''
  if (trimmedYear.length > PROFILE_LIMITS.YEAR_MAX) {
    errors.year = `Academic year cannot exceed ${PROFILE_LIMITS.YEAR_MAX} characters.`
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Fetches the student's private profile document from Firestore.
 * Safely returns null for legacy users who do not yet have a profile document.
 *
 * @param {string} userId - Authenticated user UID.
 * @returns {Promise<object|null>} Profile data object or null if not found.
 */
export async function getUserProfile(userId) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return null
  }

  if (!isFirebaseConfigured() || !db) {
    return null
  }

  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId.trim())
    const docSnap = await getDoc(userDocRef)

    if (!docSnap.exists()) {
      return null
    }

    const data = docSnap.data() || {}
    return {
      uid: docSnap.id,
      displayName: data.displayName || '',
      email: data.email || '',
      bio: data.bio || '',
      department: data.department || '',
      year: data.year || '',
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  } catch (error) {
    console.error(`Failed to fetch user profile for UID ${userId}:`, error)
    if (error?.code === 'permission-denied') {
      const customErr = new Error('Permission denied accessing user profile.')
      customErr.code = 'permission-denied'
      throw customErr
    }
    throw new Error(error.message || 'Failed to load profile details.')
  }
}

/**
 * Creates or updates the student's profile document with permitted fields only.
 * Enforces client-side validation, sets server timestamps, and protects server-managed fields.
 *
 * @param {string} userId - Authenticated user UID.
 * @param {object} profileData - Profile fields to save.
 * @param {object} [currentUserAuth] - The current Firebase Auth user instance for email binding and auth sync.
 * @returns {Promise<object>} The saved profile data.
 */
export async function saveUserProfile(userId, profileData, currentUserAuth = null) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Valid user ID is required to save profile.')
  }

  const validUserId = userId.trim()
  const validation = validateProfileInput(profileData)
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0]
    const err = new Error(firstError)
    err.validationErrors = validation.errors
    throw err
  }

  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase Firestore is not configured in this environment.')
  }

  const userDocRef = doc(db, USERS_COLLECTION, validUserId)
  let existingDocSnap = null

  try {
    existingDocSnap = await getDoc(userDocRef)
  } catch (error) {
    console.error(`Failed to verify existing user profile for UID ${validUserId}:`, error)
    if (error?.code === 'permission-denied') {
      const customErr = new Error('Permission denied accessing user profile.')
      customErr.code = 'permission-denied'
      throw customErr
    }
    throw new Error(error.message || 'Failed to check existing profile.')
  }

  const cleanDisplayName = profileData.displayName.trim()
  const cleanBio = (profileData.bio || '').trim()
  const cleanDepartment = (profileData.department || '').trim()
  const cleanYear = (profileData.year || '').trim()
  const existingEmail =
    typeof existingDocSnap?.data === 'function' ? existingDocSnap.data()?.email : null
  const userEmail = currentUserAuth?.email || existingEmail || ''

  try {
    if (existingDocSnap && existingDocSnap.exists()) {
      // Update existing profile - only allowed client-editable fields
      await updateDoc(userDocRef, {
        displayName: cleanDisplayName,
        bio: cleanBio,
        department: cleanDepartment,
        year: cleanYear,
        updatedAt: serverTimestamp(),
      })
    } else {
      // Create initial profile - idempotent and bound to authenticated UID & email
      await setDoc(userDocRef, {
        uid: validUserId,
        displayName: cleanDisplayName,
        email: userEmail,
        bio: cleanBio,
        department: cleanDepartment,
        year: cleanYear,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    // Attempt to sync Firebase Auth user displayName if accessible
    if (auth?.currentUser && auth.currentUser.uid === validUserId && cleanDisplayName) {
      try {
        await updateProfile(auth.currentUser, {
          displayName: cleanDisplayName,
        })
      } catch (authSyncErr) {
        // Non-fatal: Firestore profile was successfully saved
        console.warn('Could not sync displayName with Firebase Auth instance:', authSyncErr)
      }
    }

    return {
      uid: validUserId,
      displayName: cleanDisplayName,
      email: userEmail,
      bio: cleanBio,
      department: cleanDepartment,
      year: cleanYear,
    }
  } catch (error) {
    console.error(`Failed to save user profile for UID ${validUserId}:`, error)
    if (error?.code === 'permission-denied') {
      const customErr = new Error('Permission denied. You can only modify your own permitted profile fields.')
      customErr.code = 'permission-denied'
      throw customErr
    }
    throw new Error(error.message || 'Failed to save profile changes.')
  }
}
