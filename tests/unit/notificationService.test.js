import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateStatusNotificationMessage,
  normalizeNotificationDoc,
  calculateUnreadCount,
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../src/services/notificationService'
import * as firestore from 'firebase/firestore'

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    collection: vi.fn(),
    doc: vi.fn((_db, _col, id) => ({ id: id || 'generated-doc-id', path: `notifications/${id || 'generated-doc-id'}` })),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(),
    updateDoc: vi.fn(),
    writeBatch: vi.fn(),
  }
})

describe('notificationService Unit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateStatusNotificationMessage', () => {
    it('generates expected message for "Approved" and "Accepted" status', () => {
      expect(generateStatusNotificationMessage('Improve Campus Wi-Fi', 'Approved')).toBe(
        'Your idea "Improve Campus Wi-Fi" has been approved.'
      )
      expect(generateStatusNotificationMessage('Improve Campus Wi-Fi', 'Accepted')).toBe(
        'Your idea "Improve Campus Wi-Fi" has been approved.'
      )
    })

    it('generates expected message for "In Progress" status', () => {
      expect(generateStatusNotificationMessage('Library Study Spaces', 'In Progress')).toBe(
        'Your idea "Library Study Spaces" is now in progress.'
      )
    })

    it('generates expected message for "Under Review" status', () => {
      expect(generateStatusNotificationMessage('Bike Share Stations', 'Under Review')).toBe(
        'Your idea "Bike Share Stations" is now under review.'
      )
    })

    it('generates expected message for "Implemented" status', () => {
      expect(generateStatusNotificationMessage('Solar Benches', 'Implemented')).toBe(
        'Your idea "Solar Benches" has been implemented.'
      )
    })

    it('generates expected message for "Rejected" status', () => {
      expect(generateStatusNotificationMessage('Campus Shuttle Tracker', 'Rejected')).toBe(
        'Your idea "Campus Shuttle Tracker" has been rejected. Check the idea details for more information if available.'
      )
    })

    it('generates expected message for "Submitted" status', () => {
      expect(generateStatusNotificationMessage('New Dining Option', 'Submitted')).toBe(
        'Your idea "New Dining Option" has been submitted.'
      )
    })

    it('falls back gracefully when title is empty or null', () => {
      expect(generateStatusNotificationMessage('', 'Approved')).toBe(
        'Your idea "your proposal" has been approved.'
      )
      expect(generateStatusNotificationMessage(null, 'In Progress')).toBe(
        'Your idea "your proposal" is now in progress.'
      )
    })

    it('handles unexpected statuses with generic message', () => {
      expect(generateStatusNotificationMessage('Test Idea', 'Archived')).toBe(
        'Your idea "Test Idea" status has changed to Archived.'
      )
    })
  })

  describe('normalizeNotificationDoc', () => {
    it('returns null if docSnap is missing or does not exist', () => {
      expect(normalizeNotificationDoc(null)).toBeNull()
      expect(normalizeNotificationDoc({ exists: () => false })).toBeNull()
    })

    it('normalizes complete Firestore document snapshot', () => {
      const mockDoc = {
        id: 'notif-123',
        exists: () => true,
        data: () => ({
          recipientId: 'student-abc',
          ideaId: 'idea-xyz',
          ideaTitle: 'Renewable Power',
          type: 'idea_status_changed',
          message: 'Your idea has been approved.',
          previousStatus: 'Under Review',
          newStatus: 'Approved',
          isRead: false,
          createdAt: {
            toDate: () => new Date('2026-10-15T12:00:00Z'),
          },
        }),
      }

      const result = normalizeNotificationDoc(mockDoc)
      expect(result).toMatchObject({
        id: 'notif-123',
        recipientId: 'student-abc',
        ideaId: 'idea-xyz',
        ideaTitle: 'Renewable Power',
        type: 'idea_status_changed',
        message: 'Your idea has been approved.',
        previousStatus: 'Under Review',
        newStatus: 'Approved',
        isRead: false,
      })
      expect(result.createdAt).toBeTruthy()
    })

    it('supplies defaults for missing data fields', () => {
      const mockDoc = {
        id: 'notif-empty',
        exists: () => true,
        data: () => ({}),
      }

      const result = normalizeNotificationDoc(mockDoc)
      expect(result).toMatchObject({
        id: 'notif-empty',
        recipientId: '',
        ideaId: '',
        ideaTitle: 'Untitled Proposal',
        type: 'idea_status_changed',
        message: '',
        previousStatus: null,
        newStatus: null,
        isRead: false,
        createdAt: 'Just now',
      })
    })
  })

  describe('calculateUnreadCount', () => {
    it('returns 0 for empty or invalid input', () => {
      expect(calculateUnreadCount([])).toBe(0)
      expect(calculateUnreadCount(null)).toBe(0)
      expect(calculateUnreadCount(undefined)).toBe(0)
    })

    it('correctly counts only unread notifications', () => {
      const items = [
        { id: '1', isRead: false },
        { id: '2', isRead: true },
        { id: '3', isRead: false },
        { id: '4', isRead: false },
        { id: '5', isRead: true },
      ]
      expect(calculateUnreadCount(items)).toBe(3)
    })

    it('returns 0 when all notifications are read', () => {
      const items = [
        { id: '1', isRead: true },
        { id: '2', isRead: true },
      ]
      expect(calculateUnreadCount(items)).toBe(0)
    })
  })

  describe('subscribeToUserNotifications', () => {
    it('immediately calls onUpdate with empty array if userId is invalid', () => {
      const onUpdate = vi.fn()
      const unsubscribe = subscribeToUserNotifications('', onUpdate)

      expect(onUpdate).toHaveBeenCalledWith([])
      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('subscribes to Firestore notifications ordered newest first', () => {
      const onUpdate = vi.fn()
      const mockUnsubscribe = vi.fn()
      firestore.onSnapshot.mockImplementation((_q, callback) => {
        callback({
          docs: [
            {
              id: 'notif-1',
              exists: () => true,
              data: () => ({
                recipientId: 'user-1',
                message: 'First notification',
                createdAt: { seconds: 1000 },
              }),
            },
            {
              id: 'notif-2',
              exists: () => true,
              data: () => ({
                recipientId: 'user-1',
                message: 'Second newer notification',
                createdAt: { seconds: 2000 },
              }),
            },
          ],
        })
        return mockUnsubscribe
      })

      const unsubscribe = subscribeToUserNotifications('user-1', onUpdate)

      expect(firestore.onSnapshot).toHaveBeenCalled()
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const receivedItems = onUpdate.mock.calls[0][0]
      expect(receivedItems).toHaveLength(2)
      // Newest first
      expect(receivedItems[0].id).toBe('notif-2')
      expect(receivedItems[1].id).toBe('notif-1')

      unsubscribe()
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    })

    it('handles missing index error by falling back to unindexed query', () => {
      const onUpdate = vi.fn()
      const onError = vi.fn()
      const mockUnsubFallback = vi.fn()

      firestore.onSnapshot
        .mockImplementationOnce((_q, _success, errorCb) => {
          // Simulate Firestore index missing error
          const err = new Error('The query requires an index.')
          err.code = 'failed-precondition'
          errorCb(err)
          return vi.fn()
        })
        .mockImplementationOnce((_fallbackQ, successCb) => {
          successCb({
            docs: [
              {
                id: 'fallback-notif',
                exists: () => true,
                data: () => ({ recipientId: 'user-1', message: 'Fallback item', createdAt: { seconds: 1500 } }),
              },
            ],
          })
          return mockUnsubFallback
        })

      const unsubscribe = subscribeToUserNotifications('user-1', onUpdate, onError)

      expect(firestore.onSnapshot).toHaveBeenCalledTimes(2)
      expect(onUpdate).toHaveBeenCalled()
      unsubscribe()
      expect(mockUnsubFallback).toHaveBeenCalled()
    })
  })

  describe('markNotificationAsRead', () => {
    it('returns without error if notificationId is empty', async () => {
      await markNotificationAsRead('')
      await markNotificationAsRead(null)
      expect(firestore.updateDoc).not.toHaveBeenCalled()
    })

    it('updates isRead to true for the specified notification document', async () => {
      firestore.updateDoc.mockResolvedValueOnce()

      await markNotificationAsRead('notif-abc')

      expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'notifications', 'notif-abc')
      expect(firestore.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { isRead: true }
      )
    })
  })

  describe('markAllNotificationsAsRead', () => {
    it('returns immediately if notification IDs list is empty', async () => {
      await markAllNotificationsAsRead([])
      await markAllNotificationsAsRead(null)
      expect(firestore.writeBatch).not.toHaveBeenCalled()
    })

    it('batches updates for all given notification IDs', async () => {
      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(),
      }
      firestore.writeBatch.mockReturnValue(mockBatch)

      await markAllNotificationsAsRead(['notif-1', 'notif-2', 'notif-3'])

      expect(firestore.writeBatch).toHaveBeenCalled()
      expect(mockBatch.update).toHaveBeenCalledTimes(3)
      expect(mockBatch.commit).toHaveBeenCalledTimes(1)
    })
  })
})
