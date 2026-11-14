import { formatIdeaTimestamp } from '../services/ideasService'
import './IdeaStatusTimeline.css'

/**
 * Returns a CSS modifier class corresponding to a canonical idea status.
 * @param {string} statusName
 * @returns {string}
 */
function getTimelineStatusClass(statusName) {
  switch (statusName) {
    case 'Under Review':
      return 'status-under-review'
    case 'In Progress':
      return 'status-in-progress'
    case 'Accepted':
      return 'status-accepted'
    case 'Implemented':
      return 'status-implemented'
    case 'Rejected':
      return 'status-rejected'
    case 'Submitted':
    default:
      return 'status-submitted'
  }
}

/**
 * Returns a human-friendly status badge or icon descriptor.
 * @param {string} statusName
 * @returns {string}
 */
function getTimelineStatusIcon(statusName) {
  switch (statusName) {
    case 'Under Review':
      return '🔍'
    case 'In Progress':
      return '⚙️'
    case 'Accepted':
      return '✓'
    case 'Implemented':
      return '★'
    case 'Rejected':
      return '✕'
    case 'Submitted':
    default:
      return '📝'
  }
}

/**
 * Builds a readable description for a status transition if none is provided.
 * @param {string|null} previousStatus
 * @param {string} newStatus
 * @returns {string}
 */
function getReadableTransitionText(previousStatus, newStatus) {
  if (!previousStatus || previousStatus === newStatus) {
    if (newStatus === 'Submitted') {
      return 'Proposal submitted by student author'
    }
    return `Proposal set to ${newStatus}`
  }
  return `Status updated from ${previousStatus} to ${newStatus}`
}

/**
 * IdeaStatusTimeline Component
 *
 * Displays an ordered, chronological history of idea status transitions
 * from oldest to newest with clear visual distinction for the current active stage.
 * Handles loading, error, empty, and honest legacy states without fabricating history.
 */
function IdeaStatusTimeline({ idea, history = [], loading = false, error = null, onRetry }) {
  if (loading) {
    return (
      <div className="detail-section-card timeline-card" role="status" aria-live="polite">
        <h2 className="detail-section-title">
          <span className="detail-section-icon" aria-hidden="true">⏱️</span>
          Status History &amp; Timeline
        </h2>
        <div className="timeline-state-box timeline-loading-box">
          <div className="timeline-spinner" aria-hidden="true" />
          <p className="timeline-state-text">Loading status history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="detail-section-card timeline-card" role="alert">
        <h2 className="detail-section-title">
          <span className="detail-section-icon" aria-hidden="true">⏱️</span>
          Status History &amp; Timeline
        </h2>
        <div className="timeline-state-box timeline-error-box">
          <div className="timeline-error-icon" aria-hidden="true">⚠️</div>
          <p className="timeline-error-title">Unable to Load Status History</p>
          <p className="timeline-error-message">{typeof error === 'string' ? error : error?.message || 'Database error occurred'}</p>
          {onRetry && (
            <button
              type="button"
              className="btn btn-secondary timeline-retry-btn"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  // Deduplicate history events by ID to prevent visual repetition on retries
  const seenIds = new Set()
  const uniqueHistory = (history || []).filter((event) => {
    if (!event || !event.id) return false
    if (seenIds.has(event.id)) return false
    seenIds.add(event.id)
    return true
  })

  // Check if an initial "Submitted" event is already recorded in durable history
  const hasRecordedSubmission = uniqueHistory.some(
    (ev) => ev.previousStatus === null || Boolean(ev.isInitialSubmission)
  )

/**
 * Resolves a display timestamp for an event without re-formatting already formatted strings
 * or fabricating historical transition dates when timestamps are missing.
 * @param {object} ev
 * @returns {string|null}
 */
function resolveEventTimestamp(ev) {
  if (!ev) return null

  // If already a valid non-empty string, preserve it directly without re-formatting
  if (typeof ev.changedAt === 'string' && ev.changedAt.trim().length > 0) {
    return ev.changedAt
  }

  // If raw timestamp is available, format it
  const raw = ev.changedAtRaw || (typeof ev.changedAt === 'object' && ev.changedAt !== null ? ev.changedAt : null)
  if (raw) {
    const isFirestoreTimestamp = typeof raw.toDate === 'function'
    const isSecondsObj = typeof raw.seconds === 'number'
    const isDate = raw instanceof Date && !isNaN(raw.getTime())

    if (isFirestoreTimestamp || isSecondsObj || isDate) {
      const formatted = formatIdeaTimestamp(raw)
      if (formatted && formatted !== 'Recently' && formatted !== 'Just now') {
        return formatted
      }
    }
  }

  // Do not fabricate historical transition dates
  return null
}

/**
 * Resolves the actor attribution label for an event.
 * Initial submission events are attributed to the student author (handling anonymous accurately).
 * Later transition events are attributed to the moderator.
 * @param {object} ev
 * @param {object} idea
 * @returns {string}
 */
function getEventActorLabel(ev, idea) {
  const isInitial = ev.previousStatus === null || Boolean(ev.isInitialSubmission)

  if (isInitial) {
    const isAnonymous =
      (!ev.changedBy && !idea?.authorId) ||
      idea?.authorName === 'Anonymous Student' ||
      (!idea?.authorName && !idea?.authorId && !ev.changedBy)

    if (idea?.authorName) {
      return `Submitted by ${idea.authorName}`
    }
    if (isAnonymous) {
      return 'Submitted anonymously'
    }
    return 'Submitted by student author'
  }

  // Status transitions: enforced as moderator-only by Firestore rules
  return ev.changedBy ? 'Updated by moderator' : 'Status transition recorded'
}

  // Construct unified chronological events list
  const entries = []

  // If trustworthy creation timestamp exists and no explicit submitted event was stored,
  // display the submission timestamp from the stored data honestly.
  const hasTrustworthyCreation = Boolean(idea?.createdAt && idea?.createdAt !== 'Recently')
  if (!hasRecordedSubmission && hasTrustworthyCreation) {
    const initialEv = {
      id: `${idea?.id || 'idea'}_initial_submission`,
      ideaId: idea?.id,
      previousStatus: null,
      newStatus: 'Submitted',
      changedAt: idea.createdAt,
      changedAtRaw: idea.createdAtRaw ?? null,
      changedBy: idea.authorId ?? null,
      description: 'Proposal submitted to the campus ideas portal',
      isInitialSubmission: true,
    }
    entries.push({
      ...initialEv,
      actorLabel: getEventActorLabel(initialEv, idea),
    })
  }

  // Append history events (already sorted oldest to newest)
  uniqueHistory.forEach((ev) => {
    entries.push({
      ...ev,
      changedAt: resolveEventTimestamp(ev),
      actorLabel: getEventActorLabel(ev, idea),
      description: ev.description || getReadableTransitionText(ev.previousStatus, ev.newStatus),
    })
  })

  // Detect whether this is a legacy idea without recorded history
  // e.g. status is non-Submitted (like 'In Progress' or 'Accepted') but no status transition history exists
  const isLegacyIdeaWithoutHistory =
    uniqueHistory.length === 0 && idea?.status && idea.status !== 'Submitted'

  // Empty state: completely no entries and no creation date
  if (entries.length === 0) {
    return (
      <div className="detail-section-card timeline-card" aria-label="Status history timeline">
        <h2 className="detail-section-title">
          <span className="detail-section-icon" aria-hidden="true">⏱️</span>
          Status History &amp; Timeline
        </h2>
        <div className="timeline-state-box timeline-empty-box">
          <div className="timeline-empty-icon" aria-hidden="true">📜</div>
          <p className="timeline-empty-text">Status history is not available for earlier updates.</p>
          <span className="timeline-empty-subtext">Future status transitions will be recorded here automatically.</span>
        </div>
      </div>
    )
  }

  return (
    <section className="detail-section-card timeline-card" aria-label="Status history timeline">
      <div className="timeline-header-row">
        <h2 className="detail-section-title timeline-card-title">
          <span className="detail-section-icon" aria-hidden="true">⏱️</span>
          Status History &amp; Timeline
        </h2>
        <span className="timeline-count-badge">
          {entries.length} {entries.length === 1 ? 'Milestone' : 'Milestones'}
        </span>
      </div>

      {/* Honest legacy fallback notice: Never fabricate intermediate dates */}
      {isLegacyIdeaWithoutHistory && (
        <div className="timeline-legacy-notice" role="note">
          <span className="timeline-legacy-icon" aria-hidden="true">ℹ️</span>
          <div>
            <strong className="timeline-legacy-title">Legacy Proposal Notice</strong>
            <p className="timeline-legacy-desc">
              Status history is not available for earlier updates. The current status was reached
              prior to timeline tracking. Future transitions will be recorded.
            </p>
          </div>
        </div>
      )}

      {/* Chronological Timeline List: Oldest to Newest */}
      <ol className="timeline-list" aria-label="Status timeline events list">
        {entries.map((entry, index) => {
          // The last entry in chronological order represents the current stage
          const isLatest = index === entries.length - 1
          const isCurrentStatus = isLatest && (!idea?.status || entry.newStatus === idea.status)
          const statusClass = getTimelineStatusClass(entry.newStatus)
          const icon = getTimelineStatusIcon(entry.newStatus)

          return (
            <li
              key={entry.id}
              className={`timeline-item ${isCurrentStatus ? 'is-current' : ''}`}
              aria-current={isCurrentStatus ? 'step' : undefined}
            >
              {/* Vertical connector line */}
              <div className="timeline-line" aria-hidden="true" />

              {/* Status node marker */}
              <div className={`timeline-node ${statusClass} ${isCurrentStatus ? 'node-current' : ''}`}>
                <span className="timeline-node-icon" aria-hidden="true">{icon}</span>
                {isCurrentStatus && <span className="timeline-node-pulse" aria-hidden="true" />}
              </div>

              {/* Event Content Card */}
              <div className={`timeline-content ${isCurrentStatus ? 'content-current' : ''}`}>
                <div className="timeline-content-header">
                  <div className="timeline-status-row">
                    <span className={`idea-status-badge ${statusClass}`}>
                      <span className="status-dot" aria-hidden="true" />
                      {entry.newStatus}
                    </span>

                    {isCurrentStatus && (
                      <span className="timeline-current-pill">
                        Current Status
                      </span>
                    )}
                  </div>

                  <time className="timeline-timestamp">
                    {entry.changedAt || 'Date unavailable'}
                  </time>
                </div>

                <p className="timeline-description">{entry.description}</p>

                {entry.actorLabel && (
                  <div className="timeline-actor-row">
                    <span className="timeline-actor-label">{entry.actorLabel}</span>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
export default IdeaStatusTimeline

