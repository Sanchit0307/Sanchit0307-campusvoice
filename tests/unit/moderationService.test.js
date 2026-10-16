import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteIdea, rejectIdea } from '../../src/services/ideasService'
import * as firestore from 'firebase/firestore'

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    collection: vi.fn(),
    doc: vi.fn(),
    getDocs: vi.fn(),
    deleteDoc: vi.fn(),
    updateDoc: vi.fn(),
    writeBatch: vi.fn(),
    runTransaction: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
  }
})

describe('moderationService Unit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deleteIdea Service Method', () => {
    it('throws validation error if ideaId is null, undefined, or empty', async () => {
      await expect(deleteIdea(null)).rejects.toThrow('Valid Idea ID is required')
      await expect(deleteIdea(undefined)).rejects.toThrow('Valid Idea ID is required')
      await expect(deleteIdea('')).rejects.toThrow('Valid Idea ID is required')
      await expect(deleteIdea('   ')).rejects.toThrow('Valid Idea ID is required')
      expect(firestore.deleteDoc).not.toHaveBeenCalled()
    })

    it('fetches votes subcollection, deletes vote documents via writeBatch, and deletes idea doc', async () => {
      const mockBatch = {
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(),
      }
      firestore.writeBatch.mockReturnValue(mockBatch)

      const mockVoteDocs = [
        { id: 'voter-1', ref: { path: 'ideas/idea-1/votes/voter-1' } },
        { id: 'voter-2', ref: { path: 'ideas/idea-1/votes/voter-2' } },
      ]
      firestore.getDocs.mockResolvedValueOnce({
        empty: false,
        docs: mockVoteDocs,
      })

      firestore.deleteDoc.mockResolvedValueOnce()

      await deleteIdea('idea-1')

      // Verifies subcollection vote deletion via batch
      expect(mockBatch.delete).toHaveBeenCalledTimes(2)
      expect(mockBatch.delete).toHaveBeenCalledWith(mockVoteDocs[0].ref)
      expect(mockBatch.delete).toHaveBeenCalledWith(mockVoteDocs[1].ref)
      expect(mockBatch.commit).toHaveBeenCalledTimes(1)

      // Verifies parent idea document deletion
      expect(firestore.deleteDoc).toHaveBeenCalledTimes(1)
    })

    it('deletes idea document even if votes subcollection is empty', async () => {
      firestore.getDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      })
      firestore.deleteDoc.mockResolvedValueOnce()

      await deleteIdea('idea-empty-votes')

      expect(firestore.writeBatch).not.toHaveBeenCalled()
      expect(firestore.deleteDoc).toHaveBeenCalledTimes(1)
    })
  })

  describe('rejectIdea Service Method', () => {
    it('updates idea status to "Rejected" with serverTimestamp via atomic transaction', async () => {
      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ status: 'Submitted', authorId: 'student-1', title: 'Test Idea' }),
        }),
        update: vi.fn(),
        set: vi.fn(),
      }
      firestore.runTransaction.mockImplementation(async (_db, callback) => callback(mockTx))

      await rejectIdea('idea-to-reject')

      expect(firestore.runTransaction).toHaveBeenCalledTimes(1)
      expect(mockTx.update).toHaveBeenCalledTimes(1)
      const callArgs = mockTx.update.mock.calls[0]
      expect(callArgs[1]).toMatchObject({
        status: 'Rejected',
      })
    })

    it('throws validation error if ideaId is empty', async () => {
      await expect(rejectIdea('')).rejects.toThrow('Valid Idea ID is required')
      expect(firestore.runTransaction).not.toHaveBeenCalled()
    })
  })
})
