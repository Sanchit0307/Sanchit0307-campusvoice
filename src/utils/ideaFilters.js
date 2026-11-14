/**
 * Safely extracts a numeric epoch timestamp (in milliseconds) from an idea's
 * createdAtRaw or createdAt fields. Handles Firestore Timestamps, serialized timestamps,
 * JS Dates, and ISO/date strings, falling back to 0 for missing or invalid dates.
 *
 * @param {object} idea
 * @returns {number}
 */
export function getIdeaTimestampValue(idea) {
  if (!idea) return 0

  const raw = idea.createdAtRaw
  if (raw) {
    if (typeof raw.toMillis === 'function') {
      try {
        return raw.toMillis()
      } catch {
        // Fall through
      }
    }
    if (typeof raw.toDate === 'function') {
      try {
        const d = raw.toDate()
        if (d instanceof Date && !isNaN(d.getTime())) {
          return d.getTime()
        }
      } catch {
        // Fall through
      }
    }
    if (typeof raw === 'object' && typeof raw.seconds === 'number') {
      const nanos = typeof raw.nanoseconds === 'number' ? raw.nanoseconds / 1e6 : 0
      return raw.seconds * 1000 + nanos
    }
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return raw.getTime()
    }
    if (typeof raw === 'number' && !isNaN(raw)) {
      return raw
    }
    if (typeof raw === 'string') {
      const parsed = Date.parse(raw)
      if (!isNaN(parsed)) {
        return parsed
      }
    }
  }

  // Fallback to idea.createdAt if createdAtRaw is not parseable
  if (idea.createdAt) {
    if (idea.createdAt instanceof Date && !isNaN(idea.createdAt.getTime())) {
      return idea.createdAt.getTime()
    }
    if (typeof idea.createdAt === 'string') {
      const parsed = Date.parse(idea.createdAt)
      if (!isNaN(parsed)) {
        return parsed
      }
    }
  }

  return 0
}

/**
 * Safely extracts an upvote count from an idea, falling back gracefully to 0.
 *
 * @param {object} idea
 * @returns {number}
 */
export function getIdeaVoteCount(idea) {
  if (!idea) return 0
  if (typeof idea.upvoteCount === 'number' && !isNaN(idea.upvoteCount)) {
    return idea.upvoteCount
  }
  if (typeof idea.upvotes === 'number' && !isNaN(idea.upvotes)) {
    return idea.upvotes
  }
  return 0
}

/**
 * Filters and sorts an array of ideas based on search query, category, status, and sort option.
 * Returns a new array without mutating the input array.
 *
 * @param {Array<object>} ideas
 * @param {object} [options]
 * @param {string} [options.searchQuery='']
 * @param {string} [options.selectedCategory='All']
 * @param {string} [options.selectedStatus='All']
 * @param {'newest'|'upvotes'} [options.sortBy='newest']
 * @returns {Array<object>}
 */
export function filterAndSortIdeas(ideas = [], {
  searchQuery = '',
  selectedCategory = 'All',
  selectedStatus = 'All',
  sortBy = 'newest',
} = {}) {
  if (!Array.isArray(ideas)) {
    return []
  }

  const trimmedQuery = (searchQuery || '').trim().toLowerCase()

  const matchingIdeas = ideas.filter((idea) => {
    if (!idea) return false

    // 1. Search filter: matches either title or description case-insensitively
    if (trimmedQuery) {
      const titleMatch = (idea.title || '').toLowerCase().includes(trimmedQuery)
      const descMatch = (idea.description || '').toLowerCase().includes(trimmedQuery)
      if (!titleMatch && !descMatch) {
        return false
      }
    }

    // 2. Category filter
    if (selectedCategory !== 'All' && idea.category !== selectedCategory) {
      return false
    }

    // 3. Status filter
    if (selectedStatus !== 'All' && idea.status !== selectedStatus) {
      return false
    }

    return true
  })

  // 4. Local sorting (non-mutating)
  if (sortBy === 'default') {
    return matchingIdeas
  }

  return matchingIdeas.sort((a, b) => {
    if (sortBy === 'upvotes') {
      const votesDiff = getIdeaVoteCount(b) - getIdeaVoteCount(a)
      if (votesDiff !== 0) {
        return votesDiff
      }
      // Tie-breaker: newest first
      return getIdeaTimestampValue(b) - getIdeaTimestampValue(a)
    }

    // Default: 'newest'
    const timeDiff = getIdeaTimestampValue(b) - getIdeaTimestampValue(a)
    if (timeDiff !== 0) {
      return timeDiff
    }
    // Tie-breaker: most upvoted
    return getIdeaVoteCount(b) - getIdeaVoteCount(a)
  })
}
