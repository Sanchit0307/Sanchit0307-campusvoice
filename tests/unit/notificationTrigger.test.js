import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateIdeaStatus } from '../../src/services/ideasService'
import * as firestore from 'firebase/firestore'
import * as firebaseApp from '../../src/firebase/firebase'

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    collection: vi.fn((_db, name) => ({ id: name, path: name })),
    doc: vi.fn((_db, col, id) => ({ id, path: `${col}/${id}` })),
    runTransaction: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
  }
})

describe('notificationTrigger Suite (Atomic & Idempotent updateIdeaStatus)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('atomically updates idea status and creates notification inside runTransaction', async () => {
    const mockTx = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          title: 'Improve Campus Wi-Fi',
          authorId: 'student_456',
          status: 'Under Review',
          updatedAt: { toMillis: () => 1700000000000 },
        }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    }
    firestore.runTransaction.mockImplementation(async (_db, callback) => callback(mockTx))

    const result = await updateIdeaStatus('idea-123', 'Accepted')

    expect(firestore.runTransaction).toHaveBeenCalledTimes(1)
    expect(mockTx.get).toHaveBeenCalledTimes(1)
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'ideas/idea-123' }),
      expect.objectContaining({
        status: 'Accepted',
      })
    )

    expect(mockTx.set).toHaveBeenCalledTimes(1)
    const [notifDocArg, notifPayload] = mockTx.set.mock.calls[0]
    expect(notifDocArg.id).toBe('idea-123_Under_Review_to_Accepted_1700000000000')
    expect(notifPayload).toMatchObject({
      recipientId: 'student_456',
      ideaId: 'idea-123',
      ideaTitle: 'Improve Campus Wi-Fi',
      type: 'idea_status_changed',
      message: 'Your idea "Improve Campus Wi-Fi" has been approved.',
      previousStatus: 'Under Review',
      newStatus: 'Accepted',
      isRead: false,
    })
    expect(result).toMatchObject({ updated: true, previousStatus: 'Under Review', newStatus: 'Accepted' })
  })

  it('idempotently skips writes when target status matches existing idea status (retry safety)', async () => {
    const mockTx = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          title: 'Library Study Spaces',
          authorId: 'student_456',
          status: 'Under Review',
          updatedAt: { toMillis: () => 1700000000000 },
        }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    }
    firestore.runTransaction.mockImplementation(async (_db, callback) => callback(mockTx))

    const result = await updateIdeaStatus('idea-123', 'Under Review')

    expect(mockTx.get).toHaveBeenCalledTimes(1)
    expect(mockTx.update).not.toHaveBeenCalled()
    expect(mockTx.set).not.toHaveBeenCalled()
    expect(result).toMatchObject({ updated: false, unchanged: true, status: 'Under Review' })
  })

  it('generates distinct deterministic notification ID on a later legitimate transition back to previous status', async () => {
    // Step 1: Transition Under Review -> In Progress at T1
    const mockTx1 = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          title: 'Solar Benches',
          authorId: 'student_456',
          status: 'Under Review',
          updatedAt: { toMillis: () => 1700000001000 },
        }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    }
    firestore.runTransaction.mockImplementationOnce(async (_db, callback) => callback(mockTx1))
    await updateIdeaStatus('idea-solar', 'In Progress')

    const firstDocId = mockTx1.set.mock.calls[0][0].id
    expect(firstDocId).toBe('idea-solar_Under_Review_to_In_Progress_1700000001000')

    // Step 2: Later legitimate transition back to In Progress after proposal was at T2 (different updatedAt)
    const mockTx2 = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          title: 'Solar Benches',
          authorId: 'student_456',
          status: 'Under Review',
          updatedAt: { toMillis: () => 1700000099000 }, // fresh updatedAt from intervening state
        }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    }
    firestore.runTransaction.mockImplementationOnce(async (_db, callback) => callback(mockTx2))
    await updateIdeaStatus('idea-solar', 'In Progress')

    const secondDocId = mockTx2.set.mock.calls[0][0].id
    expect(secondDocId).toBe('idea-solar_Under_Review_to_In_Progress_1700000099000')
    expect(secondDocId).not.toBe(firstDocId)
  })

  it('guarantees that a failed transaction aborts both idea status update and notification creation', async () => {
    // Simulate transaction abort or network failure during commit
    firestore.runTransaction.mockRejectedValueOnce(new Error('Transaction aborted due to network partition'))

    await expect(updateIdeaStatus('idea-123', 'Under Review')).rejects.toThrow(
      'Transaction aborted due to network partition'
    )
  })

  it('updates status but skips notification for anonymous proposals (authorId == null)', async () => {
    const mockTx = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          title: 'Anonymous Gym Idea',
          authorId: null,
          status: 'Submitted',
        }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    }
    firestore.runTransaction.mockImplementation(async (_db, callback) => callback(mockTx))

    await updateIdeaStatus('idea-anon', 'Under Review')

    expect(mockTx.update).toHaveBeenCalledTimes(1)
    expect(mockTx.set).not.toHaveBeenCalled()
  })

  it('updates status but skips notification if moderator is author of the proposal (no self-notification)', async () => {
    const originalCurrentUser = firebaseApp.auth.currentUser
    Object.defineProperty(firebaseApp.auth, 'currentUser', {
      value: { uid: 'mod_and_author' },
      configurable: true,
    })

    try {
      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            title: 'My Own Proposal As Moderator',
            authorId: 'mod_and_author',
            status: 'Submitted',
          }),
        }),
        update: vi.fn(),
        set: vi.fn(),
      }
      firestore.runTransaction.mockImplementation(async (_db, callback) => callback(mockTx))

      await updateIdeaStatus('idea-own', 'In Progress')

      expect(mockTx.update).toHaveBeenCalledTimes(1)
      expect(mockTx.set).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(firebaseApp.auth, 'currentUser', {
        value: originalCurrentUser,
        configurable: true,
      })
    }
  })

  it('throws validation error if ideaId or newStatus is invalid', async () => {
    await expect(updateIdeaStatus('', 'Accepted')).rejects.toThrow('Valid Idea ID is required')
    await expect(updateIdeaStatus('idea-1', 'InvalidStatus')).rejects.toThrow('Invalid status "InvalidStatus"')
    expect(firestore.runTransaction).not.toHaveBeenCalled()
  })
})
