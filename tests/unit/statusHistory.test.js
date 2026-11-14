import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  updateIdeaStatus,
  createIdea,
  getStatusHistory,
  STATUS_HISTORY_SUBCOLLECTION,
} from '../../src/services/ideasService'
import * as firestore from 'firebase/firestore'
import * as firebaseApp from '../../src/firebase/firebase'

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    collection: vi.fn((_db, ...args) => ({ id: args[args.length - 1], path: args.join('/') })),
    doc: vi.fn((_db, ...args) => {
      const lastId = args[args.length - 1]
      return { id: lastId, path: args.join('/') }
    }),
    runTransaction: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn((...args) => ({ _type: 'query', args })),
    orderBy: vi.fn((field, dir) => ({ field, dir })),
    writeBatch: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
  }
})

describe('Status History Service & Atomic Workflow Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateIdeaStatus with Persistent Status History', () => {
    it('creates exactly one persistent status-history event on genuine status change', async () => {
      const originalCurrentUser = firebaseApp.auth.currentUser
      Object.defineProperty(firebaseApp.auth, 'currentUser', {
        value: { uid: 'moderator_999' },
        configurable: true,
      })

      try {
        const mockTx = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              title: 'Study Room Noise Reduction',
              authorId: 'student_101',
              status: 'Submitted',
              createdAt: { toMillis: () => 1700000000000 },
              updatedAt: { toMillis: () => 1700000000000 },
            }),
          }),
          update: vi.fn(),
          set: vi.fn(),
        }
        firestore.runTransaction.mockImplementation(async (_db, callback) => callback(mockTx))

        const result = await updateIdeaStatus('idea-noise', 'Under Review')

        expect(firestore.runTransaction).toHaveBeenCalledTimes(1)
        expect(mockTx.get).toHaveBeenCalledTimes(1)
        expect(mockTx.update).toHaveBeenCalledWith(
          expect.objectContaining({ path: 'ideas/idea-noise' }),
          expect.objectContaining({
            status: 'Under Review',
          })
        )

        // Find status history call
        const historyCall = mockTx.set.mock.calls.find(([ref]) =>
          ref.path.includes(STATUS_HISTORY_SUBCOLLECTION)
        )
        expect(historyCall).toBeDefined()
        const [histRef, histPayload] = historyCall
        expect(histRef.id).toBe('idea-noise_Submitted_to_Under_Review_1700000000000')
        expect(histPayload).toMatchObject({
          ideaId: 'idea-noise',
          previousStatus: 'Submitted',
          newStatus: 'Under Review',
          changedBy: 'moderator_999',
          description: 'Status changed from Submitted to Under Review',
        })
        expect(result.updated).toBe(true)
        expect(result.previousStatus).toBe('Submitted')
        expect(result.newStatus).toBe('Under Review')
      } finally {
        Object.defineProperty(firebaseApp.auth, 'currentUser', {
          value: originalCurrentUser,
          configurable: true,
        })
      }
    })

    it('does not create a history event or notification when status is unchanged', async () => {
      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            title: 'Study Room Noise Reduction',
            authorId: 'student_101',
            status: 'Under Review',
            updatedAt: { toMillis: () => 1700000000000 },
          }),
        }),
        update: vi.fn(),
        set: vi.fn(),
      }
      firestore.runTransaction.mockImplementation(async (_db, callback) => callback(mockTx))

      const result = await updateIdeaStatus('idea-noise', 'Under Review')

      expect(mockTx.get).toHaveBeenCalledTimes(1)
      expect(mockTx.update).not.toHaveBeenCalled()
      expect(mockTx.set).not.toHaveBeenCalled()
      expect(result).toEqual({
        updated: false,
        unchanged: true,
        status: 'Under Review',
      })
    })

    it('uses deterministic event ID protecting against duplicates on transaction retry', async () => {
      const mockTx = {
        get: vi.fn().mockImplementation(async () => {
          return {
            exists: () => true,
            data: () => ({
              title: 'Cafeteria Recycling',
              authorId: 'student_102',
              status: 'Under Review',
              updatedAt: { toMillis: () => 1700000500000 },
            }),
          }
        }),
        update: vi.fn(),
        set: vi.fn(),
      }

      // Simulate a retry where runTransaction callback runs twice (e.g. initial conflict)
      firestore.runTransaction.mockImplementation(async (_db, callback) => {
        // First execution fails (retry simulation)
        try {
          await callback(mockTx)
        } catch {
          // ignore
        }
        // Second execution succeeds
        return callback(mockTx)
      })

      await updateIdeaStatus('idea-recycle', 'Accepted')

      // All calls to history set use the EXACT same deterministic doc ID
      const historyCalls = mockTx.set.mock.calls.filter(([ref]) =>
        ref.path.includes(STATUS_HISTORY_SUBCOLLECTION)
      )
      expect(historyCalls.length).toBeGreaterThanOrEqual(1)
      const expectedId = 'idea-recycle_Under_Review_to_Accepted_1700000500000'
      historyCalls.forEach(([ref]) => {
        expect(ref.id).toBe(expectedId)
      })
    })

    it('generates a new distinct history event ID on later legitimate transitions', async () => {
      // Transition 1: Submitted -> Under Review at T1
      const mockTx1 = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            title: 'Bus Route Expansion',
            authorId: 'student_103',
            status: 'Submitted',
            updatedAt: { toMillis: () => 1700000100000 },
          }),
        }),
        update: vi.fn(),
        set: vi.fn(),
      }
      firestore.runTransaction.mockImplementationOnce(async (_db, callback) => callback(mockTx1))
      await updateIdeaStatus('idea-bus', 'Under Review')

      const firstHistoryCall = mockTx1.set.mock.calls.find(([ref]) =>
        ref.path.includes(STATUS_HISTORY_SUBCOLLECTION)
      )
      expect(firstHistoryCall[0].id).toBe('idea-bus_Submitted_to_Under_Review_1700000100000')

      // Transition 2: Under Review -> In Progress at T2 (updatedAt updated to T2)
      const mockTx2 = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            title: 'Bus Route Expansion',
            authorId: 'student_103',
            status: 'Under Review',
            updatedAt: { toMillis: () => 1700000200000 },
          }),
        }),
        update: vi.fn(),
        set: vi.fn(),
      }
      firestore.runTransaction.mockImplementationOnce(async (_db, callback) => callback(mockTx2))
      await updateIdeaStatus('idea-bus', 'In Progress')

      const secondHistoryCall = mockTx2.set.mock.calls.find(([ref]) =>
        ref.path.includes(STATUS_HISTORY_SUBCOLLECTION)
      )
      expect(secondHistoryCall[0].id).toBe('idea-bus_Under_Review_to_In_Progress_1700000200000')
      expect(secondHistoryCall[0].id).not.toBe(firstHistoryCall[0].id)
    })
  })

  describe('createIdea with Atomic Initial Submitted History Event', () => {
    it('creates idea and initial Submitted history event atomically via writeBatch', async () => {
      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(),
      }
      firestore.writeBatch.mockReturnValue(mockBatch)

      const created = await createIdea({
        title: 'Fresh Farmers Market on Campus Quad',
        description: 'Host bi-weekly farmers market with student-grown produce and healthy meals.',
        category: 'Dining',
        authorId: 'author_777',
        authorName: 'Sam Student',
      })

      expect(firestore.writeBatch).toHaveBeenCalledTimes(1)
      expect(mockBatch.set).toHaveBeenCalledTimes(2)

      // First writeBatch set: idea parent document
      const [ideaDocRef, ideaPayload] = mockBatch.set.mock.calls[0]
      expect(ideaPayload.title).toBe('Fresh Farmers Market on Campus Quad')
      expect(ideaPayload.status).toBe('Submitted')
      expect(ideaPayload.authorId).toBe('author_777')

      // Second writeBatch set: initial status history event
      const [historyDocRef, historyPayload] = mockBatch.set.mock.calls[1]
      expect(historyDocRef.path).toContain(STATUS_HISTORY_SUBCOLLECTION)
      expect(historyDocRef.id).toBe(`${ideaDocRef.id}_init`)
      expect(historyPayload).toMatchObject({
        ideaId: ideaDocRef.id,
        previousStatus: null,
        newStatus: 'Submitted',
        changedBy: 'author_777',
        description: 'Proposal submitted',
      })

      expect(mockBatch.commit).toHaveBeenCalledTimes(1)
      expect(created.id).toBe(ideaDocRef.id)
      expect(created.status).toBe('Submitted')
    })
  })

  describe('getStatusHistory Service Function', () => {
    it('returns status history events ordered from oldest to newest', async () => {
      const mockHistoryDocs = [
        {
          id: 'event-1',
          data: () => ({
            ideaId: 'idea-order',
            previousStatus: null,
            newStatus: 'Submitted',
            changedAt: { toMillis: () => 1700000000000 },
            changedBy: 'student_1',
            description: 'Proposal submitted',
          }),
        },
        {
          id: 'event-2',
          data: () => ({
            ideaId: 'idea-order',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedAt: { toMillis: () => 1700000100000 },
            changedBy: 'mod_1',
            description: 'Status changed from Submitted to Under Review',
          }),
        },
        {
          id: 'event-3',
          data: () => ({
            ideaId: 'idea-order',
            previousStatus: 'Under Review',
            newStatus: 'In Progress',
            changedAt: { toMillis: () => 1700000200000 },
            changedBy: 'mod_2',
            description: 'Status changed from Under Review to In Progress',
          }),
        },
      ]

      firestore.getDocs.mockResolvedValueOnce({
        docs: mockHistoryDocs,
      })

      const events = await getStatusHistory('idea-order')

      expect(events).toHaveLength(3)
      expect(events[0].newStatus).toBe('Submitted')
      expect(events[1].newStatus).toBe('Under Review')
      expect(events[2].newStatus).toBe('In Progress')
      expect(events[0].id).toBe('event-1')
      expect(events[2].id).toBe('event-3')
    })

    it('falls back to client-side sort if Firestore index is missing or building', async () => {
      const indexError = new Error('The query requires an index.')
      indexError.code = 'failed-precondition'

      // First call throws missing-index precondition error
      firestore.getDocs.mockRejectedValueOnce(indexError)

      // Fallback query returns unsorted documents
      const unsortedDocs = [
        {
          id: 'event-later',
          data: () => ({
            ideaId: 'idea-index',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedAt: { toMillis: () => 1700000200000 },
          }),
        },
        {
          id: 'event-earlier',
          data: () => ({
            ideaId: 'idea-index',
            previousStatus: null,
            newStatus: 'Submitted',
            changedAt: { toMillis: () => 1700000100000 },
          }),
        },
      ]
      firestore.getDocs.mockResolvedValueOnce({
        docs: unsortedDocs,
      })

      const events = await getStatusHistory('idea-index')

      expect(events).toHaveLength(2)
      // Safely sorted client-side oldest to newest
      expect(events[0].id).toBe('event-earlier')
      expect(events[1].id).toBe('event-later')
    })

    it('handles missing or malformed timestamps without crashing', async () => {
      const corruptDocs = [
        {
          id: 'event-null-time',
          data: () => ({
            ideaId: 'idea-time',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedAt: null,
          }),
        },
        {
          id: 'event-corrupt-time',
          data: () => ({
            ideaId: 'idea-time',
            previousStatus: 'Under Review',
            newStatus: 'Accepted',
            changedAt: 'invalid-date-string',
          }),
        },
      ]

      firestore.getDocs.mockResolvedValueOnce({
        docs: corruptDocs,
      })

      const events = await getStatusHistory('idea-time')

      expect(events).toHaveLength(2)
      expect(events[0].changedAt).toBe('Just now')
      expect(events[1].changedAt).toBe('invalid-date-string')
    })

    it('returns empty array when ideaId is empty or non-string', async () => {
      expect(await getStatusHistory('')).toEqual([])
      expect(await getStatusHistory(null)).toEqual([])
      expect(await getStatusHistory(undefined)).toEqual([])
      expect(firestore.getDocs).not.toHaveBeenCalled()
    })
  })
})
