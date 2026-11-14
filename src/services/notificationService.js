import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/firebase'
import { formatIdeaTimestamp } from './ideasService'

export const NOTIFICATIONS_COLLECTION = 'notifications'

export const NOTIFICATION_TYPES = Object.freeze({
  IDEA_STATUS_CHANGED: 'idea_status_changed',
})

/**
 * Generates an understandable, user-friendly notification message based on the new status.
 *
 * @param {string} ideaTitle - Snapshot of the proposal's title.
 * @param {string} newStatus - The canonical new status.
 * @returns {string} User-facing notification message text.
 */
export function generateStatusNotificationMessage(ideaTitle, newStatus) {
  const title = (ideaTitle || 'your proposal').trim()

  switch (newStatus) {
    case 'Accepted':
    case 'Approved':
      return `Your idea "${title}" has been approved.`
    case 'In Progress':
      return `Your idea "${title}" is now in progress.`
    case 'Implemented':
      return `Your idea "${title}" has been implemented.`
    case 'Under Review':
      return `Your idea "${title}" is now under review.`
    case 'Rejected':
      return `Your idea "${title}" has been rejected. Check the idea details for more information if available.`
    case 'Submitted':
      return `Your idea "${title}" has been submitted.`
    default:
      return `Your idea "${title}" status has changed to ${newStatus}.`
  }
}

/**
 * Normalizes a Firestore document snapshot into an application Notification object.
 *
 * @param {import('firebase/firestore').DocumentSnapshot} docSnap
 * @returns {object|null}
 */
export function normalizeNotificationDoc(docSnap) {
  if (!docSnap || !docSnap.exists()) {
    return null
  }

  const data = docSnap.data() || {}

  return {
    id: docSnap.id,
    recipientId: data.recipientId || '',
    ideaId: data.ideaId || '',
    ideaTitle: data.ideaTitle || 'Untitled Proposal',
    type: data.type || NOTIFICATION_TYPES.IDEA_STATUS_CHANGED,
    message: data.message || '',
    previousStatus: data.previousStatus || null,
    newStatus: data.newStatus || null,
    isRead: Boolean(data.isRead),
    createdAt: formatIdeaTimestamp(data.createdAt),
    createdAtRaw: data.createdAt ?? null,
  }
}

/**
 * Calculates unread notifications count from a list of normalized notification objects.
 *
 * @param {Array<object>} notifications
 * @returns {number}
 */
export function calculateUnreadCount(notifications) {
  if (!Array.isArray(notifications)) {
    return 0
  }
  return notifications.reduce((count, notif) => (notif && !notif.isRead ? count + 1 : count), 0)
}

/**
 * Safely extracts milliseconds from various timestamp representations for client-side sorting.
 *
 * @param {any} rawTs
 * @returns {number}
 */
function getTimestampMillis(rawTs) {
  if (!rawTs) return 0
  if (typeof rawTs.toMillis === 'function') {
    try {
      return rawTs.toMillis()
    } catch {
      return 0
    }
  }
  if (typeof rawTs.seconds === 'number') {
    return rawTs.seconds * 1000
  }
  if (rawTs instanceof Date) {
    return rawTs.getTime()
  }
  return 0
}

/**
 * Asserts that Firebase and Firestore are configured before database operations.
 */
function assertFirebaseConfigured() {
  if (!isFirebaseConfigured() || !db) {
    const err = new Error(
      'Firebase is not configured. Please define your VITE_FIREBASE_* credentials in .env.'
    )
    err.code = 'firebase/not-configured'
    throw err
  }
}

/**
 * Subscribes in real-time to notifications belonging exclusively to the specified student UID.
 * Automatically falls back to an unindexed query with client-side sorting if composite indexes
 * are not yet provisioned in the Firestore environment.
 *
 * @param {string} userId - Authenticated student's UID.
 * @param {function(Array<object>): void} onUpdate - Callback invoked on receiving data.
 * @param {function(Error): void} [onError] - Callback invoked on subscription errors.
 * @returns {function(): void} Unsubscribe function to release Firestore listener.
 */
export function subscribeToUserNotifications(userId, onUpdate, onError) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    if (typeof onUpdate === 'function') {
      onUpdate([])
    }
    return () => {}
  }

  if (!isFirebaseConfigured() || !db) {
    if (typeof onUpdate === 'function') {
      onUpdate([])
    }
    return () => {}
  }

  const cleanUserId = userId.trim()
  const notifsCol = collection(db, NOTIFICATIONS_COLLECTION)

  let activeUnsubscribe = null
  let isCancelled = false

  const handleSnapshot = (snapshot) => {
    if (isCancelled) return
    const notifs = snapshot.docs
      .map((docSnap) => normalizeNotificationDoc(docSnap))
      .filter(Boolean)

    // Ensure order is newest first regardless of server vs client sorting
    notifs.sort((a, b) => getTimestampMillis(b.createdAtRaw) - getTimestampMillis(a.createdAtRaw))

    if (typeof onUpdate === 'function') {
      onUpdate(notifs)
    }
  }

  const setupSubscription = () => {
    // 1. Attempt the indexed query with orderBy('createdAt', 'desc')
    try {
      const indexedQuery = query(
        notifsCol,
        where('recipientId', '==', cleanUserId),
        orderBy('createdAt', 'desc')
      )

      const unsubPrimary = onSnapshot(
        indexedQuery,
        handleSnapshot,
        (error) => {
          if (isCancelled) return

          const isMissingIndex =
            error?.code === 'failed-precondition' &&
            error?.message?.toLowerCase().includes('index')

          if (isMissingIndex) {
            console.warn(
              '[NotificationService] Index for (recipientId, createdAt desc) not found. Falling back to client-sorted query.',
              error
            )
            // Fall back to unindexed query
            try {
              const fallbackQuery = query(
                notifsCol,
                where('recipientId', '==', cleanUserId)
              )
              const unsubFallback = onSnapshot(fallbackQuery, handleSnapshot, (fallbackErr) => {
                if (isCancelled) return
                console.error('[NotificationService] Fallback subscription error:', fallbackErr)
                if (typeof onError === 'function') onError(fallbackErr)
              })
              activeUnsubscribe = unsubFallback
            } catch (fallbackInitErr) {
              console.error('[NotificationService] Fallback init error:', fallbackInitErr)
              if (typeof onError === 'function') onError(fallbackInitErr)
            }
          } else {
            console.error('[NotificationService] Realtime subscription error:', error)
            if (typeof onError === 'function') onError(error)
          }
        }
      )

      if (!activeUnsubscribe) {
        activeUnsubscribe = unsubPrimary
      }
    } catch (initialErr) {
      if (isCancelled) return
      console.warn('[NotificationService] Initial subscription setup error, using fallback:', initialErr)
      try {
        const fallbackQuery = query(notifsCol, where('recipientId', '==', cleanUserId))
        activeUnsubscribe = onSnapshot(fallbackQuery, handleSnapshot, (fallbackErr) => {
          if (isCancelled) return
          if (typeof onError === 'function') onError(fallbackErr)
        })
      } catch (fallbackInitErr) {
        if (typeof onError === 'function') onError(fallbackInitErr)
      }
    }
  }

  setupSubscription()

  return () => {
    isCancelled = true
    if (typeof activeUnsubscribe === 'function') {
      activeUnsubscribe()
    }
  }
}

/**
 * Marks a single notification document as read.
 * Protected by Firestore Security Rules to ensure only the recipient can perform this update.
 *
 * @param {string} notificationId - ID of the notification document.
 * @returns {Promise<void>}
 */
export async function markNotificationAsRead(notificationId) {
  assertFirebaseConfigured()

  if (!notificationId || typeof notificationId !== 'string' || !notificationId.trim()) {
    return
  }

  try {
    const notifRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId.trim())
    await updateDoc(notifRef, {
      isRead: true,
    })
  } catch (error) {
    console.error(`Error marking notification ${notificationId} as read:`, error)
    throw error
  }
}

/**
 * Marks all unread notifications for a user as read in an atomic Firestore batch.
 *
 * @param {Array<string>} unreadNotificationIds - Array of document IDs to mark as read.
 * @returns {Promise<void>}
 */
export async function markAllNotificationsAsRead(unreadNotificationIds) {
  assertFirebaseConfigured()

  if (!Array.isArray(unreadNotificationIds) || unreadNotificationIds.length === 0) {
    return
  }

  try {
    const batch = writeBatch(db)
    unreadNotificationIds.forEach((id) => {
      if (id && typeof id === 'string') {
        const notifRef = doc(db, NOTIFICATIONS_COLLECTION, id.trim())
        batch.update(notifRef, { isRead: true })
      }
    })
    await batch.commit()
  } catch (error) {
    console.error('Error batch marking all notifications as read:', error)
    throw error
  }
}
