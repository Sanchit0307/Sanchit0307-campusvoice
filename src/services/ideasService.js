import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/firebase'

const IDEAS_COLLECTION = 'ideas'

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
 * @returns {object}
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
    createdAt: formatIdeaTimestamp(data.createdAt),
    createdAtRaw: data.createdAt ?? null,
    updatedAt: formatIdeaTimestamp(data.updatedAt),
    updatedAtRaw: data.updatedAt ?? null,
  }
}

/**
 * Maps Firestore errors into human-readable, categorized messages.
 * @param {Error} error
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
      'Firestore permission denied. Please verify your Firestore Security Rules in the Firebase Console.'
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
 * Creates a new idea in the Firestore 'ideas' collection.
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
 * Separately handles missing-index errors.
 * @returns {Promise<Array<object>>}
 */
export async function getIdeas() {
  assertFirebaseConfigured()

  const ideasCol = collection(db, IDEAS_COLLECTION)
  const orderedQuery = query(ideasCol, orderBy('createdAt', 'desc'))

  try {
    const snapshot = await getDocs(orderedQuery)
    return snapshot.docs.map((docSnap) => normalizeIdeaDoc(docSnap))
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
        return items.sort((a, b) => {
          const aTime = a.createdAtRaw?.seconds || 0
          const bTime = b.createdAtRaw?.seconds || 0
          return bTime - aTime
        })
      } catch (fallbackError) {
        throw handleFirestoreError(fallbackError, 'Failed to fetch ideas list')
      }
    }

    console.error('Error fetching ideas list from Firestore:', error)
    throw handleFirestoreError(error, 'Failed to fetch ideas list')
  }
}

/**
 * Fetches a single idea document by its Firestore document ID.
 * Returns null if the document does not exist.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getIdeaById(id) {
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

    return normalizeIdeaDoc(docSnap)
  } catch (error) {
    console.error(`Error fetching idea document with ID "${id}":`, error)
    throw handleFirestoreError(error, `Failed to load idea details for ${id}`)
  }
}

/**
 * Updates editable fields of an idea document in Firestore.
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
