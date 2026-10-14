import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getCountFromServer,
  runTransaction,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/firebase'

const IDEAS_COLLECTION = 'ideas'
const VOTES_SUBCOLLECTION = 'votes'
const MODERATORS_COLLECTION = 'moderators'

export const IDEA_STATUSES = Object.freeze([
  'Submitted',
  'Under Review',
  'In Progress',
  'Accepted',
  'Implemented',
  'Rejected',
])

/**
 * Formats a Firestore timestamp, JS Date, or raw timestamp value into a readable string.
 * @param {any} timestamp
 * @returns {string}
 */
export function formatIdeaTimestamp(timestamp) {
  if (!timestamp) {
    return 'Just now'
  }

  // Handle Firestore Timestamp object
  if (typeof timestamp.toDate === 'function') {
    try {
      const date = timestamp.toDate()
      return formatDate(date)
    } catch {
      return 'Recently'
    }
  }

  // Handle serialized Firestore timestamp { seconds, nanoseconds }
  if (typeof timestamp === 'object' && typeof timestamp.seconds === 'number') {
    try {
      const date = new Date(timestamp.seconds * 1000)
      return formatDate(date)
    } catch {
      return 'Recently'
    }
  }

  // Handle JS Date instance
  if (timestamp instanceof Date) {
    return formatDate(timestamp)
  }

  // Return existing string representation directly
  if (typeof timestamp === 'string') {
    return timestamp
  }

  return 'Recently'
}

function formatDate(date) {
  if (isNaN(date.getTime())) {
    return 'Recently'
  }

  // Format with readable date: e.g. "Oct 9, 2026"
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Normalizes a Firestore document snapshot into an application Idea object.
 * Preserves compatibility with existing components expecting either `upvotes` or `upvoteCount`.
 * @param {import('firebase/firestore').DocumentSnapshot} docSnap
 * @returns {object|null}
 */
export function normalizeIdeaDoc(docSnap) {
  if (!docSnap || !docSnap.exists()) {
    return null
  }

  const data = docSnap.data() || {}
  const upvoteCount =
    typeof data.upvoteCount === 'number'
      ? data.upvoteCount
      : typeof data.upvotes === 'number'
        ? data.upvotes
        : 0

  return {
    id: docSnap.id,
    title: data.title || '',
    description: data.description || '',
    category: data.category || 'General',
    authorId: data.authorId ?? null,
    authorName: data.authorName || 'Anonymous Student',
    status: data.status || 'Submitted',
    upvoteCount,
    // Preserve legacy upvotes field for backward compatibility with existing components
    upvotes: upvoteCount,
    hasUpvoted: false,
    createdAt: formatIdeaTimestamp(data.createdAt),
    createdAtRaw: data.createdAt ?? null,
    updatedAt: formatIdeaTimestamp(data.updatedAt),
    updatedAtRaw: data.updatedAt ?? null,
  }
}

/**
 * Maps Firestore errors into human-readable, categorized messages.
 * @param {Error} error
 * @param {string} [contextMessage]
 * @returns {Error}
 */
function handleFirestoreError(error, contextMessage = 'Database operation failed') {
  if (!error) {
    return new Error(contextMessage)
  }

  const code = error.code || ''
  const message = error.message || ''

  if (code === 'permission-denied') {
    const customErr = new Error(
      'Firestore permission denied. Please verify your authentication status and Firestore Security Rules.'
    )
    customErr.code = code
    return customErr
  }

  if (code === 'unavailable') {
    const customErr = new Error(
      'Firestore is currently unavailable. Please verify your internet connection.'
    )
    customErr.code = code
    return customErr
  }

  if (code === 'not-found') {
    const customErr = new Error('Requested idea document could not be found.')
    customErr.code = code
    return customErr
  }

  if (code === 'failed-precondition' && message.toLowerCase().includes('index')) {
    const customErr = new Error(
      'Firestore query requires an index. Check the Firebase Console to build the required index.'
    )
    customErr.code = code
    return customErr
  }

  return new Error(`${contextMessage}: ${message || code || 'Unknown error'}`)
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
 * Authoritatively derives the live vote count for an idea from its votes subcollection.
 * Uses Firestore's getCountFromServer() aggregation query (1 read per 1,000 counted index entries).
 * @param {string} ideaId
 * @returns {Promise<number>}
 */
export async function getIdeaVoteCount(ideaId) {
  assertFirebaseConfigured()

  if (!ideaId || typeof ideaId !== 'string') {
    return 0
  }

  try {
    const votesCol = collection(db, IDEAS_COLLECTION, ideaId, VOTES_SUBCOLLECTION)
    const snapshot = await getCountFromServer(votesCol)
    return snapshot.data().count || 0
  } catch (error) {
    console.error(`Error fetching vote count for idea ${ideaId}:`, error)
    throw handleFirestoreError(error, `Failed to fetch vote count for idea ${ideaId}`)
  }
}

/**
 * Checks whether the specified user has an existing vote document in ideas/{ideaId}/votes/{userId}.
 * @param {string} ideaId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function hasUserUpvoted(ideaId, userId) {
  if (!isFirebaseConfigured() || !db) {
    return false
  }

  if (!ideaId || !userId || typeof ideaId !== 'string' || typeof userId !== 'string') {
    return false
  }

  try {
    const voteRef = doc(db, IDEAS_COLLECTION, ideaId, VOTES_SUBCOLLECTION, userId)
    const voteSnap = await getDoc(voteRef)
    return voteSnap.exists()
  } catch (error) {
    console.error(`Error checking vote status for user ${userId} on idea ${ideaId}:`, error)
    throw handleFirestoreError(error, `Failed to check vote status for idea ${ideaId}`)
  }
}

/**
 * Concurrency-safe toggle for an authenticated user's upvote on a proposal.
 * Uses a Firestore runTransaction() to inspect and atomically create or delete
 * the user's vote document at ideas/{ideaId}/votes/{userId}.
 *
 * Concurrency & Integrity Guarantees:
 * - If the vote document exists, it is deleted (unvote).
 * - If the vote document does not exist, it is created (upvote) with valid schema.
 * - Firestore transactions serialize database writes, ensuring atomic commit.
 *   However, simultaneous actions across tabs or rapid clicks may still encounter
 *   conflicts; UI callers must maintain pending button locks and reconcile actual
 *   Firestore state using reconcileVoteState() on errors or failed writes.
 * - Authorization boundary: The actual permission check is enforced by Firestore
 *   Security Rules (request.auth.uid == userId); the caller must pass the active
 *   user's verified UID from Firebase Auth.
 *
 * Returns the new user vote state and the authoritative server-derived count.
 *
 * @param {string} ideaId
 * @param {string} userId
 * @returns {Promise<{ hasUpvoted: boolean, upvoteCount: number|null }>}
 */
export async function toggleUpvote(ideaId, userId) {
  assertFirebaseConfigured()

  if (!ideaId || typeof ideaId !== 'string') {
    throw new Error('Valid Idea ID is required to toggle an upvote.')
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('Authenticated User ID is required to toggle an upvote.')
  }

  const voteDocRef = doc(db, IDEAS_COLLECTION, ideaId, VOTES_SUBCOLLECTION, userId)

  let transactionResult
  try {
    transactionResult = await runTransaction(db, async (transaction) => {
      const voteSnap = await transaction.get(voteDocRef)

      if (voteSnap.exists()) {
        // Vote document exists -> user is unvoting (toggle off)
        transaction.delete(voteDocRef)
        return { hasUpvoted: false }
      }

      // Vote document does not exist -> user is voting (toggle on)
      transaction.set(voteDocRef, {
        userId,
        createdAt: serverTimestamp(),
      })
      return { hasUpvoted: true }
    })
  } catch (error) {
    console.error(
      `Transaction failed while toggling upvote on idea ${ideaId} for user ${userId}:`,
      error
    )
    throw handleFirestoreError(error, `Failed to update vote on idea ${ideaId}`)
  }

  const hasUpvoted = transactionResult?.hasUpvoted ?? false

  // Authoritatively derive the new count from Firestore
  try {
    const updatedCount = await getIdeaVoteCount(ideaId)
    return {
      hasUpvoted,
      upvoteCount: updatedCount,
    }
  } catch (countError) {
    console.warn(
      `Vote toggled successfully, but failed to fetch updated count for idea ${ideaId}:`,
      countError
    )
    return {
      hasUpvoted,
      upvoteCount: null,
    }
  }
}

/**
 * Reconciles the local client UI state with authoritative database state.
 * Called after failed writes or when recovering from network/permission errors.
 * @param {string} ideaId
 * @param {string|null} [userId]
 * @returns {Promise<{ upvoteCount: number, hasUpvoted: boolean }>}
 */
export async function reconcileVoteState(ideaId, userId = null) {
  assertFirebaseConfigured()

  const countPromise = getIdeaVoteCount(ideaId)
  const userVotePromise = userId ? hasUserUpvoted(ideaId, userId) : Promise.resolve(false)

  const [upvoteCount, hasUpvoted] = await Promise.all([countPromise, userVotePromise])
  return {
    upvoteCount,
    hasUpvoted,
  }
}

/**
 * Creates a new idea in the Firestore 'ideas' collection.
 * Preserves the exact 9-field schema validated by Issue #6.
 *
 * @param {object} ideaInput
 * @param {string} ideaInput.title
 * @param {string} ideaInput.description
 * @param {string} ideaInput.category
 * @param {string} [ideaInput.authorName]
 * @param {string|null} [ideaInput.authorId]
 * @returns {Promise<object>} The newly created idea object with its Firestore document ID.
 */
export async function createIdea({
  title,
  description,
  category,
  authorName = 'Anonymous Student',
  authorId = null,
}) {
  assertFirebaseConfigured()

  const trimmedTitle = (title || '').trim()
  const trimmedDesc = (description || '').trim()
  const trimmedCategory = (category || '').trim()

  if (!trimmedTitle) {
    throw new Error('Title is required to create an idea.')
  }
  if (!trimmedDesc) {
    throw new Error('Description is required to create an idea.')
  }
  if (!trimmedCategory) {
    throw new Error('Category is required to create an idea.')
  }

  const docPayload = {
    title: trimmedTitle,
    description: trimmedDesc,
    category: trimmedCategory,
    authorId: authorId ?? null,
    authorName: (authorName || '').trim() || 'Anonymous Student',
    status: 'Submitted',
    upvoteCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  try {
    const ideasCol = collection(db, IDEAS_COLLECTION)
    const docRef = await addDoc(ideasCol, docPayload)

    return {
      id: docRef.id,
      ...docPayload,
      upvotes: 0,
      hasUpvoted: false,
      createdAt: 'Just now',
      updatedAt: 'Just now',
    }
  } catch (error) {
    console.error('Error creating idea document in Firestore:', error)
    throw handleFirestoreError(error, 'Failed to submit idea proposal')
  }
}

/**
 * Fetches the ideas list from Firestore ordered by creation date (newest first).
 * Authoritatively attaches server-derived vote counts from the votes subcollection.
 * If currentUserId is provided, also checks whether the user has upvoted each idea.
 *
 * Per-Idea Aggregation Cost Note:
 * For N ideas, this issues N lightweight getCountFromServer aggregation queries.
 * In Firestore, each aggregation query costs only 1 document read per 1,000 counted index entries.
 *
 * @param {string|null} [currentUserId] - Optional UID of current user to check vote state.
 * @returns {Promise<Array<object>>}
 */
export async function getIdeas(currentUserId = null) {
  assertFirebaseConfigured()

  const ideasCol = collection(db, IDEAS_COLLECTION)
  const orderedQuery = query(ideasCol, orderBy('createdAt', 'desc'))

  let ideaDocs = []

  try {
    const snapshot = await getDocs(orderedQuery)
    ideaDocs = snapshot.docs.map((docSnap) => normalizeIdeaDoc(docSnap))
  } catch (error) {
    // Specifically handle missing-index error separately
    const isMissingIndex =
      error?.code === 'failed-precondition' &&
      error?.message?.toLowerCase().includes('index')

    if (isMissingIndex) {
      console.warn(
        'Firestore query orderBy("createdAt", "desc") requires an index that is building or missing. Falling back to unindexed query temporarily.',
        error
      )
      try {
        const fallbackSnapshot = await getDocs(ideasCol)
        const items = fallbackSnapshot.docs.map((docSnap) => normalizeIdeaDoc(docSnap))
        // Sort client-side by raw timestamp or fallback
        ideaDocs = items.sort((a, b) => {
          const aTime = a.createdAtRaw?.seconds || 0
          const bTime = b.createdAtRaw?.seconds || 0
          return bTime - aTime
        })
      } catch (fallbackError) {
        throw handleFirestoreError(fallbackError, 'Failed to fetch ideas list')
      }
    } else {
      console.error('Error fetching ideas list from Firestore:', error)
      throw handleFirestoreError(error, 'Failed to fetch ideas list')
    }
  }

  // Derive vote count and user upvote status for each idea in parallel
  const augmentedIdeas = await Promise.all(
    ideaDocs.map(async (idea) => {
      try {
        const countPromise = getIdeaVoteCount(idea.id)
        const userVotePromise = currentUserId
          ? hasUserUpvoted(idea.id, currentUserId)
          : Promise.resolve(false)

        const [authoritativeCount, hasUpvoted] = await Promise.all([
          countPromise,
          userVotePromise,
        ])

        return {
          ...idea,
          upvoteCount: authoritativeCount,
          upvotes: authoritativeCount,
          hasUpvoted,
        }
      } catch (countErr) {
        // Fall back gracefully to the initial count if subcollection read fails
        console.warn(`Could not derive votes for idea ${idea.id}:`, countErr)
        return {
          ...idea,
          hasUpvoted: false,
        }
      }
    })
  )

  return augmentedIdeas
}

/**
 * Fetches a single idea document by its Firestore document ID.
 * Authoritatively attaches the server-derived vote count from its votes subcollection.
 * If currentUserId is provided, also checks whether the user has upvoted this idea.
 *
 * @param {string} id
 * @param {string|null} [currentUserId]
 * @returns {Promise<object|null>}
 */
export async function getIdeaById(id, currentUserId = null) {
  assertFirebaseConfigured()

  if (!id || typeof id !== 'string') {
    return null
  }

  try {
    const docRef = doc(db, IDEAS_COLLECTION, id)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    const normalizedIdea = normalizeIdeaDoc(docSnap)

    // Authoritatively attach live vote count and user status
    try {
      const countPromise = getIdeaVoteCount(id)
      const userVotePromise = currentUserId
        ? hasUserUpvoted(id, currentUserId)
        : Promise.resolve(false)

      const [authoritativeCount, hasUpvoted] = await Promise.all([
        countPromise,
        userVotePromise,
      ])

      return {
        ...normalizedIdea,
        upvoteCount: authoritativeCount,
        upvotes: authoritativeCount,
        hasUpvoted,
      }
    } catch (countErr) {
      console.warn(`Could not derive vote count for idea ${id}:`, countErr)
      return {
        ...normalizedIdea,
        hasUpvoted: false,
      }
    }
  } catch (error) {
    console.error(`Error fetching idea document with ID "${id}":`, error)
    throw handleFirestoreError(error, `Failed to load idea details for ${id}`)
  }
}

/**
 * Updates editable fields of an idea document in Firestore.
 * Preserved for future administrative workflows.
 *
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<void>}
 */
export async function updateIdea(id, updateData) {
  assertFirebaseConfigured()

  if (!id) {
    throw new Error('Idea ID is required to update an idea.')
  }

  try {
    const docRef = doc(db, IDEAS_COLLECTION, id)
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error(`Error updating idea document with ID "${id}":`, error)
    throw handleFirestoreError(error, `Failed to update idea ${id}`)
  }
}

const maskUid = (id) => {
  if (!id || typeof id !== 'string') return 'none'
  const str = id.trim()
  return str.length > 8 ? `${str.slice(0, 4)}...${str.slice(-4)}` : `${str.slice(0, 2)}***`
}

let checkIsModeratorCounter = 0

/**
 * Checks whether the given user has an authorized moderator role.
 * Queries the 'moderators/{userId}' document and verifies role === 'moderator'.
 *
 * @param {string} userId - Authenticated user's UID.
 * @returns {Promise<boolean>}
 */
export async function checkIsModerator(userId) {
  const checkId = ++checkIsModeratorCounter
  const maskedUid = maskUid(userId)

  if (import.meta.env.DEV) {
    console.info(`[AuthDiag #${checkId}] Moderator check ATTEMPTED`, {
      maskedUid,
      firebaseConfigured: isFirebaseConfigured(),
      dbInitialized: Boolean(db),
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'not-set',
    })
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    if (import.meta.env.DEV) {
      console.info(`[AuthDiag #${checkId}] Check aborted: empty or non-string userId.`)
    }
    return false
  }

  if (!isFirebaseConfigured() || !db) {
    if (import.meta.env.DEV) {
      console.warn(`[AuthDiag #${checkId}] Check aborted: Firebase or Firestore not configured.`)
    }
    return false
  }

  const cleanUserId = userId.trim()
  const modRef = doc(db, MODERATORS_COLLECTION, cleanUserId)

  const verifySnapshot = (snap) => {
    if (!snap || typeof snap.exists !== 'function' || !snap.exists()) {
      if (import.meta.env.DEV) {
        console.info(`[AuthDiag #${checkId}] Document does NOT exist at ${MODERATORS_COLLECTION}/${maskedUid}`)
      }
      return false
    }
    const data = (typeof snap.data === 'function' ? snap.data() : null) || {}
    const rawRole = data.role ?? data.Role
    const normalizedRole =
      typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : ''
    const roleMatched = normalizedRole === 'moderator'
    if (import.meta.env.DEV) {
      console.info(`[AuthDiag #${checkId}] Document exists at ${MODERATORS_COLLECTION}/${maskedUid}`, {
        rawRole,
        roleMatched,
      })
    }
    return roleMatched
  }

  try {
    const modSnap = await getDoc(modRef)
    const result = verifySnapshot(modSnap)
    if (import.meta.env.DEV) {
      console.info(`[AuthDiag #${checkId}] Moderator check COMPLETED: result=${result}`)
    }
    return result
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[AuthDiag #${checkId}] Firestore getDoc error:`, {
        code: error?.code,
        message: error?.message,
      })
    }

    // If permission-denied occurs during early auth token propagation, retry once after a short delay
    if (error?.code === 'permission-denied') {
      try {
        if (import.meta.env.DEV) {
          console.info(`[AuthDiag #${checkId}] Retrying getDoc in 350ms due to permission-denied...`)
        }
        await new Promise((resolve) => setTimeout(resolve, 350))
        const retrySnap = await getDoc(modRef)
        const retryResult = verifySnapshot(retrySnap)
        if (import.meta.env.DEV) {
          console.info(`[AuthDiag #${checkId}] Retry COMPLETED: result=${retryResult}`)
        }
        return retryResult
      } catch (retryError) {
        if (import.meta.env.DEV) {
          console.warn(`[AuthDiag #${checkId}] Retry FAILED:`, {
            code: retryError?.code,
            message: retryError?.message,
          })
        }
        return false
      }
    }

    console.warn(`Error verifying moderator status for user ${cleanUserId}:`, error)
    return false
  }
}

/**
 * Updates the workflow status of an idea proposal.
 * Validates that the new status belongs to the 5 canonical statuses.
 * Authorization is strictly enforced at the Firestore Security Rules boundary (requires isModerator).
 *
 * @param {string} ideaId - Document ID of the idea to update.
 * @param {string} newStatus - The new canonical status string.
 * @returns {Promise<void>}
 */
export async function updateIdeaStatus(ideaId, newStatus) {
  assertFirebaseConfigured()

  if (!ideaId || typeof ideaId !== 'string' || !ideaId.trim()) {
    throw new Error('Valid Idea ID is required to update idea status.')
  }

  if (!IDEA_STATUSES.includes(newStatus)) {
    throw new Error(
      `Invalid status "${newStatus}". Must be one of: ${IDEA_STATUSES.join(', ')}.`
    )
  }

  try {
    const docRef = doc(db, IDEAS_COLLECTION, ideaId.trim())
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error(`Error updating status for idea ${ideaId} to ${newStatus}:`, error)
    throw handleFirestoreError(error, `Failed to update status for idea ${ideaId}`)
  }
}

/**
 * Convenience helper for authorized moderators to reject an idea proposal.
 * Updates the proposal's status in Firestore to 'Rejected' while preserving document data.
 *
 * @param {string} ideaId - Document ID of the idea to reject.
 * @returns {Promise<void>}
 */
export async function rejectIdea(ideaId) {
  return updateIdeaStatus(ideaId, 'Rejected')
}

/**
 * Permanently deletes an idea proposal and all associated vote documents in ideas/{ideaId}/votes.
 * Restricted to verified moderators by Firestore Security Rules.
 *
 * Note on Subcollection Deletion Limitation:
 * In Cloud Firestore, client-side parent document deletion does NOT automatically delete subcollections.
 * This client helper cleans up all vote documents in chunks before removing the parent document.
 * For production scale with thousands of subcollection documents, a trusted backend Cloud Function
 * (e.g., recursiveDelete via Firebase Admin SDK) is recommended.
 *
 * @param {string} ideaId - Document ID of the idea to delete.
 * @returns {Promise<void>}
 */
export async function deleteIdea(ideaId) {
  assertFirebaseConfigured()

  if (!ideaId || typeof ideaId !== 'string' || !ideaId.trim()) {
    throw new Error('Valid Idea ID is required to remove an idea proposal.')
  }

  const cleanIdeaId = ideaId.trim()
  const maskedIdeaId = cleanIdeaId.length > 8
    ? `${cleanIdeaId.slice(0, 4)}...${cleanIdeaId.slice(-4)}`
    : `${cleanIdeaId.slice(0, 2)}***`

  let currentStep = 'init'

  try {
    // 1. Fetch all vote documents in ideas/{ideaId}/votes
    currentStep = 'read_votes_subcollection'
    if (import.meta.env.DEV) {
      console.info(`[DeleteDiag] Step 1: Reading votes for idea ${maskedIdeaId}...`)
    }
    const votesCol = collection(db, IDEAS_COLLECTION, cleanIdeaId, VOTES_SUBCOLLECTION)
    const votesSnapshot = await getDocs(votesCol)
    if (import.meta.env.DEV) {
      console.info(`[DeleteDiag] Step 1 SUCCEEDED: Found ${votesSnapshot.size} votes.`)
    }

    // 2. Delete all votes in batches of up to 400
    if (!votesSnapshot.empty) {
      currentStep = 'delete_votes_batch'
      if (import.meta.env.DEV) {
        console.info(`[DeleteDiag] Step 2: Batch deleting ${votesSnapshot.size} vote documents...`)
      }
      const batchSize = 400
      let batch = writeBatch(db)
      let count = 0

      for (const voteDoc of votesSnapshot.docs) {
        batch.delete(voteDoc.ref)
        count++
        if (count >= batchSize) {
          await batch.commit()
          batch = writeBatch(db)
          count = 0
        }
      }

      if (count > 0) {
        await batch.commit()
      }
      if (import.meta.env.DEV) {
        console.info(`[DeleteDiag] Step 2 SUCCEEDED: All votes removed.`)
      }
    } else {
      if (import.meta.env.DEV) {
        console.info(`[DeleteDiag] Step 2 SKIPPED: Subcollection has 0 votes.`)
      }
    }

    // 3. Delete the parent idea document
    currentStep = 'delete_parent_idea_document'
    if (import.meta.env.DEV) {
      console.info(`[DeleteDiag] Step 3: Deleting parent idea document ${maskedIdeaId}...`)
    }
    const ideaDocRef = doc(db, IDEAS_COLLECTION, cleanIdeaId)
    await deleteDoc(ideaDocRef)
    if (import.meta.env.DEV) {
      console.info(`[DeleteDiag] Step 3 SUCCEEDED: Idea ${maskedIdeaId} successfully deleted.`)
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[DeleteDiag] FAILED at step '${currentStep}':`, {
        code: error?.code,
        message: error?.message,
      })
    }
    console.error(`Error deleting idea document ${cleanIdeaId} at step '${currentStep}':`, error)
    throw handleFirestoreError(error, `Failed to delete idea proposal ${cleanIdeaId}`)
  }
}

/**
 * Fetches ideas submitted by a specific student, identified by their authenticated userId.
 * Safely excludes null or missing authorId, sorts results client-side by creation date (newest first)
 * to avoid requiring composite indexes, and attaches authoritative vote counts.
 *
 * @param {string} userId - The authenticated student's UID.
 * @returns {Promise<Array<object>>}
 */
export async function getUserIdeas(userId) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return []
  }

  assertFirebaseConfigured()

  const validUserId = userId.trim()
  const ideasCol = collection(db, IDEAS_COLLECTION)
  const userIdeasQuery = query(ideasCol, where('authorId', '==', validUserId))

  let userDocs = []
  try {
    const snapshot = await getDocs(userIdeasQuery)
    userDocs = snapshot.docs
      .map((docSnap) => normalizeIdeaDoc(docSnap))
      .filter((idea) => idea && idea.authorId === validUserId)
  } catch (error) {
    console.error(`Error fetching user ideas for authorId ${validUserId}:`, error)
    throw handleFirestoreError(error, 'Failed to fetch your submitted proposals')
  }

  // Safe client-side sort by newest first (handles missing or null timestamps gracefully)
  userDocs.sort((a, b) => {
    const getTimestampValue = (idea) => {
      if (!idea.createdAtRaw) return 0
      if (typeof idea.createdAtRaw.toMillis === 'function') {
        try {
          return idea.createdAtRaw.toMillis()
        } catch {
          return 0
        }
      }
      if (typeof idea.createdAtRaw.seconds === 'number') {
        return idea.createdAtRaw.seconds * 1000
      }
      if (idea.createdAtRaw instanceof Date) {
        return idea.createdAtRaw.getTime()
      }
      return 0
    }

    return getTimestampValue(b) - getTimestampValue(a)
  })

  // Authoritatively attach live vote counts for each user idea
  const augmentedUserIdeas = await Promise.all(
    userDocs.map(async (idea) => {
      try {
        const countPromise = getIdeaVoteCount(idea.id)
        const userVotePromise = hasUserUpvoted(idea.id, validUserId)
        const [authoritativeCount, hasUpvoted] = await Promise.all([
          countPromise,
          userVotePromise,
        ])

        return {
          ...idea,
          upvoteCount: authoritativeCount,
          upvotes: authoritativeCount,
          hasUpvoted,
        }
      } catch (countErr) {
        console.warn(`Could not derive vote count for user idea ${idea.id}:`, countErr)
        return {
          ...idea,
          upvoteCount: null,
          upvotes: null,
          hasUpvoted: null,
        }
      }
    })
  )

  return augmentedUserIdeas
}
