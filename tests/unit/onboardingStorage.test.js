import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStorageKey,
  getOnboardingStatus,
  setOnboardingStatus,
  clearOnboardingStatus,
  resetMemoryFallback,
} from '../../src/utils/onboardingStorage'

describe('onboardingStorage Utility Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMemoryFallback()
    vi.restoreAllMocks()
  })

  it('generates a user-scoped storage key with prefix', () => {
    expect(getStorageKey('user-123')).toBe('campusvoice_onboarding_user-123')
    expect(getStorageKey('  student-abc  ')).toBe('campusvoice_onboarding_student-abc')
    expect(getStorageKey('')).toBeNull()
    expect(getStorageKey(null)).toBeNull()
    expect(getStorageKey(undefined)).toBeNull()
  })

  it('returns null when no onboarding status is recorded for the user', () => {
    expect(getOnboardingStatus('fresh-student-uid')).toBeNull()
  })

  it('persists and retrieves completed onboarding status for a user', () => {
    const success = setOnboardingStatus('user-student-1', {
      completed: true,
      skipped: false,
      role: 'student',
    })
    expect(success).toBe(true)

    const status = getOnboardingStatus('user-student-1')
    expect(status).not.toBeNull()
    expect(status.completed).toBe(true)
    expect(status.skipped).toBe(false)
    expect(status.role).toBe('student')
    expect(typeof status.completedAt).toBe('string')
  })

  it('persists and retrieves skipped onboarding status for a user', () => {
    setOnboardingStatus('user-student-2', {
      completed: false,
      skipped: true,
      role: 'student',
    })

    const status = getOnboardingStatus('user-student-2')
    expect(status).not.toBeNull()
    expect(status.completed).toBe(false)
    expect(status.skipped).toBe(true)
  })

  it('strictly isolates onboarding state between distinct user UIDs', () => {
    setOnboardingStatus('user-alice', { completed: true, skipped: false })
    setOnboardingStatus('user-bob', { completed: false, skipped: true })

    const aliceStatus = getOnboardingStatus('user-alice')
    const bobStatus = getOnboardingStatus('user-bob')
    const charlieStatus = getOnboardingStatus('user-charlie')

    expect(aliceStatus.completed).toBe(true)
    expect(bobStatus.completed).toBe(false)
    expect(bobStatus.skipped).toBe(true)
    expect(charlieStatus).toBeNull()
  })

  it('clears onboarding status for a specific user without affecting others', () => {
    setOnboardingStatus('user-1', { completed: true })
    setOnboardingStatus('user-2', { completed: true })

    clearOnboardingStatus('user-1')

    expect(getOnboardingStatus('user-1')).toBeNull()
    expect(getOnboardingStatus('user-2')).not.toBeNull()
  })

  it('handles localStorage exceptions gracefully via in-memory fallback', () => {
    // Simulate quota exceeded or private browsing access restriction
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: DOM Exception 22')
    })
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: Access denied')
    })

    const writeResult = setOnboardingStatus('user-fallback-test', {
      completed: true,
      skipped: false,
      role: 'moderator',
    })
    expect(writeResult).toBe(true)

    const status = getOnboardingStatus('user-fallback-test')
    expect(status).not.toBeNull()
    expect(status.completed).toBe(true)
    expect(status.role).toBe('moderator')

    setItemSpy.mockRestore()
    getItemSpy.mockRestore()
  })
})
