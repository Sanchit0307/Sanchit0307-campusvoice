import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/firebase'
import { checkIsModerator, IDEA_STATUSES, normalizeIdeaDoc } from './ideasService'
import { IDEA_CATEGORIES } from '../data/mockIdeas'
import { getIdeaTimestampValue } from '../utils/ideaFilters'

export { IDEA_STATUSES, IDEA_CATEGORIES }

/**
 * Supported date range preset options.
 */
export const DATE_RANGE_OPTIONS = Object.freeze([
  { id: 'all', label: 'All Time' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'custom', label: 'Custom Range' },
])

/**
 * Status grouping mapping definitions.
 * Every canonical status maps to exactly one group to prevent double-counting or omissions.
 */
export const STATUS_GROUP_MAPPINGS = Object.freeze({
  PENDING_REVIEW: Object.freeze(['Submitted', 'Under Review']),
  IN_PROGRESS: Object.freeze(['In Progress']),
  ACCEPTED_OR_IMPLEMENTED: Object.freeze(['Accepted', 'Implemented']),
  REJECTED: Object.freeze(['Rejected']),
})

/**
 * Format a Date or epoch timestamp to 'YYYY-MM-DD' in local time.
 * @param {Date|number} dateInput
 * @returns {string}
 */
export function formatDateKey(dateInput) {
  if (!dateInput) return ''
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculates raw counts for each canonical status and tracks any unrecognized/legacy statuses.
 * @param {Array<object>} ideas
 * @returns {Record<string, number>}
 */
export function calculateStatusCounts(ideas = []) {
  const counts = {}
  for (const status of IDEA_STATUSES) {
    counts[status] = 0
  }
  counts.Other = 0

  if (!Array.isArray(ideas)) {
    return counts
  }

  for (const idea of ideas) {
    if (!idea) continue
    const status = idea.status
    if (typeof status === 'string' && Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status]++
    } else {
      counts.Other++
    }
  }

  return counts
}

/**
 * Computes mutually exclusive high-level status groups from status counts.
 * Guarantees that:
 * pendingReview + inProgress + acceptedOrImplemented + rejected + other === totalIdeas
 *
 * @param {Record<string, number>} statusCounts
 * @returns {{
 *   pendingReview: number,
 *   inProgress: number,
 *   accepted: number,
 *   implemented: number,
 *   acceptedOrImplemented: number,
 *   rejected: number,
 *   other: number,
 *   totalGrouped: number
 * }}
 */
export function getStatusGroups(statusCounts = {}) {
  const getCount = (key) => (typeof statusCounts[key] === 'number' ? statusCounts[key] : 0)

  const pendingReview =
    getCount('Submitted') + getCount('Under Review')
  const inProgress = getCount('In Progress')
  const accepted = getCount('Accepted')
  const implemented = getCount('Implemented')
  const acceptedOrImplemented = accepted + implemented
  const rejected = getCount('Rejected')
  const other = getCount('Other')

  const totalGrouped = pendingReview + inProgress + acceptedOrImplemented + rejected + other

  return {
    pendingReview,
    inProgress,
    accepted,
    implemented,
    acceptedOrImplemented,
    rejected,
    other,
    totalGrouped,
  }
}

/**
 * Calculates counts of ideas for each canonical category.
 * Unrecognized, missing, or legacy categories are aggregated into 'Other'.
 *
 * @param {Array<object>} ideas
 * @returns {Record<string, number>}
 */
export function calculateCategoryCounts(ideas = []) {
  const counts = {}
  for (const cat of IDEA_CATEGORIES) {
    counts[cat] = 0
  }
  counts.Other = 0

  if (!Array.isArray(ideas)) {
    return counts
  }

  for (const idea of ideas) {
    if (!idea) continue
    const category = idea.category
    if (typeof category === 'string' && Object.prototype.hasOwnProperty.call(counts, category)) {
      counts[category]++
    } else {
      counts.Other++
    }
  }

  return counts
}

/**
 * Calculates submission trends over time by date.
 * Groups creation timestamps into daily buckets ('YYYY-MM-DD') sorted chronologically.
 *
 * @param {Array<object>} ideas
 * @param {object} [options]
 * @param {Date|number|string|null} [options.startDate] - Optional start date boundary (inclusive)
 * @param {Date|number|string|null} [options.endDate] - Optional end date boundary (inclusive)
 * @returns {Array<{ date: string, count: number }>}
 */
export function calculateSubmissionTrends(ideas = [], options = {}) {
  if (!Array.isArray(ideas)) {
    return []
  }

  const { startDate = null, endDate = null } = options

  let startMillis = 0
  let endMillis = Infinity

  if (startDate) {
    const s = startDate instanceof Date ? startDate.getTime() : new Date(startDate).getTime()
    if (!isNaN(s)) {
      startMillis = s
    }
  }

  if (endDate) {
    const e = endDate instanceof Date ? endDate.getTime() : new Date(endDate).getTime()
    if (!isNaN(e)) {
      endMillis = e
    }
  }

  // Aggregate counts by 'YYYY-MM-DD'
  const dateMap = new Map()

  for (const idea of ideas) {
    if (!idea) continue
    const millis = getIdeaTimestampValue(idea)
    // Discard missing (0) or out-of-boundary timestamps
    if (!millis || millis < startMillis || millis > endMillis) {
      continue
    }

    const dateKey = formatDateKey(millis)
    if (!dateKey) continue

    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
  }

  // Sort chronologically by date string
  const sortedDates = Array.from(dateMap.keys()).sort()
  return sortedDates.map((date) => ({
    date,
    count: dateMap.get(date),
  }))
}

/**
 * Aggregates all idea metrics in a pure, deterministic, client-side computation.
 *
 * @param {Array<object>} ideas - List of idea objects (normalized or raw Firestore docs).
 * @param {object} [options]
 * @param {Date|number|string|null} [options.startDate]
 * @param {Date|number|string|null} [options.endDate]
 * @returns {{
 *   totalIdeas: number,
 *   statusCounts: Record<string, number>,
 *   statusGroups: {
 *     pendingReview: number,
 *     inProgress: number,
 *     accepted: number,
 *     implemented: number,
 *     acceptedOrImplemented: number,
 *     rejected: number,
 *     other: number,
 *     totalGrouped: number,
 *   },
 *   categoryCounts: Record<string, number>,
 *   submissionTrends: Array<{ date: string, count: number }>,
 *   totalVotes: number,
 *   averageVotesPerIdea: number,
 * }}
 */
export function aggregateIdeaMetrics(ideas = [], options = {}) {
  const safeIdeas = Array.isArray(ideas) ? ideas.filter(Boolean) : []
  const totalIdeas = safeIdeas.length

  const statusCounts = calculateStatusCounts(safeIdeas)
  const statusGroups = getStatusGroups(statusCounts)
  const categoryCounts = calculateCategoryCounts(safeIdeas)
  const submissionTrends = calculateSubmissionTrends(safeIdeas, options)

  let totalVotes = 0
  for (const idea of safeIdeas) {
    const votes =
      typeof idea.upvoteCount === 'number'
        ? idea.upvoteCount
        : typeof idea.upvotes === 'number'
          ? idea.upvotes
          : 0
    totalVotes += Math.max(0, votes)
  }

  const averageVotesPerIdea = totalIdeas > 0 ? Math.round((totalVotes / totalIdeas) * 10) / 10 : 0

  return {
    totalIdeas,
    statusCounts,
    statusGroups,
    categoryCounts,
    submissionTrends,
    totalVotes,
    averageVotesPerIdea,
  }
}

/**
 * Filters ideas in memory by category and date range without requiring additional Firestore queries.
 * Handles boundary conditions cleanly (start-of-day 00:00:00 to end-of-day 23:59:59.999).
 *
 * @param {Array<object>} ideas
 * @param {object} [filters]
 * @param {string} [filters.category='All']
 * @param {'all'|'7d'|'30d'|'90d'|'custom'} [filters.dateRange='all']
 * @param {Date|string|null} [filters.customStartDate=null]
 * @param {Date|string|null} [filters.customEndDate=null]
 * @param {Date} [now=new Date()] - Optional reference date for deterministic testing
 * @returns {Array<object>}
 */
export function filterAnalyticsIdeas(ideas = [], filters = {}, now = new Date()) {
  if (!Array.isArray(ideas)) return []
  const {
    category = 'All',
    dateRange = 'all',
    customStartDate = null,
    customEndDate = null,
  } = filters

  let startMillis = 0
  let endMillis = Infinity

  if (dateRange === '7d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    startMillis = d.getTime()
  } else if (dateRange === '30d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    startMillis = d.getTime()
  } else if (dateRange === '90d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 90)
    d.setHours(0, 0, 0, 0)
    startMillis = d.getTime()
  } else if (dateRange === 'custom') {
    if (customStartDate) {
      const s = customStartDate instanceof Date ? new Date(customStartDate) : new Date(customStartDate)
      if (!isNaN(s.getTime())) {
        s.setHours(0, 0, 0, 0)
        startMillis = s.getTime()
      }
    }
    if (customEndDate) {
      const e = customEndDate instanceof Date ? new Date(customEndDate) : new Date(customEndDate)
      if (!isNaN(e.getTime())) {
        e.setHours(23, 59, 59, 999)
        endMillis = e.getTime()
      }
    }
  }

  return ideas.filter((idea) => {
    if (!idea) return false

    // Category filter
    if (category && category !== 'All') {
      if (idea.category !== category) return false
    }

    // Date range filter
    if (startMillis > 0 || endMillis < Infinity) {
      const millis = getIdeaTimestampValue(idea)
      if (!millis || millis < startMillis || millis > endMillis) {
        return false
      }
    }

    return true
  })
}

/**
 * Fetches ideas directly from Firestore and computes aggregated analytics.
 * Strictly verifies moderator authorization before querying or returning analytics.
 *
 * Cost Optimization & Scalability:
 * - Reads only the parent `ideas` documents without making N secondary subcollection reads.
 * - Single collection snapshot read (1 read per document), keeping query overhead minimal.
 * - For small-to-medium datasets (hundreds to thousands of ideas), client-side aggregation
 *   avoids Cloud Function infrastructure costs and provides instant multi-dimensional slicing.
 *
 * @param {object|string} userOrUid - Authenticated user object (from useAuth) or UID string.
 * @param {object} [options] - Aggregation options (e.g. startDate, endDate).
 * @returns {Promise<{
 *   metrics: ReturnType<typeof aggregateIdeaMetrics>,
 *   ideas: Array<object>,
 *   fetchedAt: Date,
 * }>}
 */
export async function fetchModeratorAnalytics(userOrUid, options = {}) {
  const uid = typeof userOrUid === 'string' ? userOrUid : userOrUid?.uid

  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    const error = new Error('Authentication required: A valid moderator session is required.')
    error.code = 'unauthenticated'
    throw error
  }

  // 1. Strict Moderator Authorization Check
  const isMod = await checkIsModerator(uid)
  if (!isMod) {
    const error = new Error('Permission denied: Only authorized moderators can access analytics data.')
    error.code = 'permission-denied'
    throw error
  }

  // 2. Configuration Assertion
  if (!isFirebaseConfigured() || !db) {
    const error = new Error(
      'Firebase is not configured. Please define your VITE_FIREBASE_* credentials in .env.'
    )
    error.code = 'firebase/not-configured'
    throw error
  }

  // 3. Fetch Ideas Collection
  const ideasCol = collection(db, 'ideas')
  const orderedQuery = query(ideasCol, orderBy('createdAt', 'desc'))

  let ideaDocs = []

  try {
    const snapshot = await getDocs(orderedQuery)
    ideaDocs = snapshot.docs.map((docSnap) => normalizeIdeaDoc(docSnap))
  } catch (queryErr) {
    const isMissingIndex =
      queryErr?.code === 'failed-precondition' &&
      queryErr?.message?.toLowerCase().includes('index')

    if (isMissingIndex) {
      console.warn(
        'Analytics query orderBy("createdAt", "desc") requires building index. Falling back to unindexed query.',
        queryErr
      )
      try {
        const fallbackSnapshot = await getDocs(ideasCol)
        ideaDocs = fallbackSnapshot.docs.map((docSnap) => normalizeIdeaDoc(docSnap))
      } catch (fallbackErr) {
        throw new Error(`Failed to load ideas for analytics: ${fallbackErr.message || fallbackErr.code}`)
      }
    } else {
      throw new Error(`Failed to load ideas for analytics: ${queryErr.message || queryErr.code}`)
    }
  }

  // 4. Compute In-Memory Aggregations
  const metrics = aggregateIdeaMetrics(ideaDocs, options)

  return {
    metrics,
    ideas: ideaDocs,
    fetchedAt: new Date(),
  }
}
