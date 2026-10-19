/**
 * Utility for user-scoped onboarding completion persistence.
 *
 * Scoped to the authenticated user's stable Firebase UID to prevent
 * cross-account collision on shared machines.
 *
 * Uses localStorage with graceful in-memory fallback for private
 * browsing, restricted cookie policies, or storage quota errors.
 */

const STORAGE_PREFIX = 'campusvoice_onboarding_'

// In-memory fallback map if localStorage is blocked or unavailable
const memoryFallback = new Map()

/**
 * Checks if localStorage is available and working.
 * @returns {boolean}
 */
function isLocalStorageAvailable() {
  try {
    const testKey = '__campusvoice_storage_test__'
    window.localStorage.setItem(testKey, testKey)
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Generates the storage key for a user.
 * @param {string} uid - Authenticated user UID.
 * @returns {string}
 */
export function getStorageKey(uid) {
  if (!uid || typeof uid !== 'string') {
    return null
  }
  return `${STORAGE_PREFIX}${uid.trim()}`
}

/**
 * Retrieves the stored onboarding status for a specific user.
 *
 * @param {string} uid - The authenticated user's UID.
 * @returns {{ completed: boolean, skipped: boolean, completedAt?: string, role?: string } | null}
 */
export function getOnboardingStatus(uid) {
  const key = getStorageKey(uid)
  if (!key) return null

  try {
    if (isLocalStorageAvailable()) {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        return JSON.parse(raw)
      }
    }
  } catch (err) {
    console.warn('[Onboarding] Error reading onboarding state from localStorage:', err)
  }

  // Check in-memory fallback
  return memoryFallback.get(key) || null
}

/**
 * Persists the onboarding status for a specific user.
 *
 * @param {string} uid - The authenticated user's UID.
 * @param {{ completed?: boolean, skipped?: boolean, role?: string }} data
 * @returns {boolean} True if successfully stored.
 */
export function setOnboardingStatus(uid, { completed = false, skipped = false, role = 'student' } = {}) {
  const key = getStorageKey(uid)
  if (!key) return false

  const payload = {
    completed: Boolean(completed),
    skipped: Boolean(skipped),
    completedAt: new Date().toISOString(),
    role: role || 'student',
  }

  let storedInLocalStorage = false

  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.setItem(key, JSON.stringify(payload))
      storedInLocalStorage = true
    }
  } catch (err) {
    console.warn('[Onboarding] Error writing onboarding state to localStorage, using in-memory fallback:', err)
  }

  // Always update in-memory fallback as mirror
  memoryFallback.set(key, payload)
  return storedInLocalStorage || true
}

/**
 * Clears the stored onboarding status for a user.
 * Useful for debugging, testing, or reset workflows.
 *
 * @param {string} uid - The authenticated user's UID.
 */
export function clearOnboardingStatus(uid) {
  const key = getStorageKey(uid)
  if (!key) return

  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(key)
    }
  } catch (err) {
    console.warn('[Onboarding] Error clearing onboarding state from localStorage:', err)
  }

  memoryFallback.delete(key)
}

/**
 * Resets the in-memory fallback cache (used by unit tests).
 */
export function resetMemoryFallback() {
  memoryFallback.clear()
}
