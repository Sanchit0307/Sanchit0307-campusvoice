import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  fetchModeratorAnalytics,
  filterAnalyticsIdeas,
  aggregateIdeaMetrics,
} from '../../services/analyticsService'
import AnalyticsMetricCard from './AnalyticsMetricCard'
import StatusDistributionChart from './StatusDistributionChart'
import CategoryDistributionChart from './CategoryDistributionChart'
import SubmissionsTrendChart from './SubmissionsTrendChart'
import AnalyticsFilterBar from './AnalyticsFilterBar'
import './ModeratorAnalyticsDashboard.css'

const DEFAULT_FILTERS = Object.freeze({
  dateRange: 'all',
  category: 'All',
  customStartDate: '',
  customEndDate: '',
})

/**
 * Moderator Analytics Dashboard Component.
 *
 * @param {object} props
 * @param {object} props.user - Active user object from AuthContext
 * @param {boolean} props.isModerator - Verified moderator flag
 * @param {Array<object>} [props.initialIdeas] - Optional preloaded idea list
 */
export default function ModeratorAnalyticsDashboard({
  user,
  isModerator = false,
  initialIdeas = null,
}) {
  const [ideas, setIdeas] = useState(() => (Array.isArray(initialIdeas) ? initialIdeas : []))
  const [loading, setLoading] = useState(() => !Array.isArray(initialIdeas) || initialIdeas.length === 0)
  const [error, setError] = useState(null)
  const [lastFetchedAt, setLastFetchedAt] = useState(() =>
    Array.isArray(initialIdeas) && initialIdeas.length > 0 ? new Date() : null
  )

  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const loadAnalytics = useCallback(async () => {
    if (!user || !isModerator) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchModeratorAnalytics(user)
      setIdeas(data.ideas || [])
      setLastFetchedAt(data.fetchedAt || new Date())
    } catch (err) {
      console.error('Failed to load moderator analytics:', err)
      setError(err.message || 'Unable to load analytics data from Firestore.')
    } finally {
      setLoading(false)
    }
  }, [user, isModerator])

  useEffect(() => {
    let isCancelled = false

    if (!Array.isArray(initialIdeas) || initialIdeas.length === 0) {
      if (isModerator && user) {
        fetchModeratorAnalytics(user)
          .then((data) => {
            if (!isCancelled) {
              setIdeas(data.ideas || [])
              setLastFetchedAt(data.fetchedAt || new Date())
              setLoading(false)
            }
          })
          .catch((err) => {
            if (!isCancelled) {
              console.error('Failed to load moderator analytics:', err)
              setError(err.message || 'Unable to load analytics data from Firestore.')
              setLoading(false)
            }
          })
      }
    }

    return () => {
      isCancelled = true
    }
  }, [user, isModerator, initialIdeas])

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  // In-memory filtered dataset (instant reactivity, zero repeated Firestore reads)
  const filteredIdeas = useMemo(() => {
    return filterAnalyticsIdeas(ideas, filters)
  }, [ideas, filters])

  // Aggregated metrics over the filtered ideas
  const metrics = useMemo(() => {
    let startDate = null
    let endDate = null

    if (filters.dateRange === 'custom') {
      startDate = filters.customStartDate || null
      endDate = filters.customEndDate || null
    }

    return aggregateIdeaMetrics(filteredIdeas, { startDate, endDate })
  }, [filteredIdeas, filters.dateRange, filters.customStartDate, filters.customEndDate])

  // Security guard in UI: Only authorized moderators can view
  if (!isModerator) {
    return (
      <div className="ideas-state-card is-error" role="alert" data-testid="analytics-unauthorized">
        <div className="badge not-found-badge">Staff Access Only</div>
        <h2 className="ideas-state-title">Moderator Privileges Required</h2>
        <p className="ideas-state-desc">
          The Analytics Dashboard contains privileged campus-wide administrative insights and is strictly restricted to verified moderators.
        </p>
      </div>
    )
  }

  return (
    <div
      className="analytics-dashboard-container"
      id="moderator-analytics-dashboard"
      data-testid="moderator-analytics-dashboard"
    >
      {/* Header & Controls */}
      <header className="analytics-dashboard-header">
        <div className="analytics-dashboard-heading-group">
          <h2 className="analytics-dashboard-title">
            <span>📊 Moderator Analytics Dashboard</span>
          </h2>
          <p className="analytics-dashboard-desc">
            Campus-wide proposal metrics, workflow progression, and submission trends.
          </p>
        </div>

        <div className="analytics-dashboard-actions">
          {lastFetchedAt && (
            <span className="analytics-last-updated" title={lastFetchedAt.toLocaleString()}>
              Updated: {lastFetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            className="analytics-refresh-btn"
            onClick={loadAnalytics}
            disabled={loading}
            data-testid="analytics-refresh-btn"
            aria-label="Refresh analytics data from database"
          >
            <span>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>
      </header>

      {/* Loading State */}
      {loading ? (
        <div className="ideas-state-card" role="status" aria-live="polite" data-testid="analytics-loading">
          <div className="ideas-loading-spinner" aria-hidden="true" />
          <h2 className="ideas-state-title">Loading Analytics Dashboard...</h2>
          <p className="ideas-state-desc">Aggregating campus ideas and submission trends.</p>
        </div>
      ) : error ? (
        /* Error State */
        <div className="ideas-state-card is-error" role="alert" data-testid="analytics-error">
          <div className="badge not-found-badge">Database Error</div>
          <h2 className="ideas-state-title">Failed to Load Analytics</h2>
          <p className="ideas-state-desc">{error}</p>
          <div className="ideas-state-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={loadAnalytics}
              data-testid="analytics-retry-btn"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : ideas.length === 0 ? (
        /* Empty Database State */
        <div className="ideas-state-card" role="status" data-testid="analytics-empty-db">
          <div className="empty-state-icon" aria-hidden="true">📭</div>
          <h2 className="ideas-state-title">No Campus Ideas Found</h2>
          <p className="ideas-state-desc">
            There are currently no proposals submitted in the database to generate analytics.
          </p>
        </div>
      ) : (
        /* Data Loaded View */
        <>
          {/* Issue #10: Filter Bar */}
          <AnalyticsFilterBar
            filters={filters}
            onFilterChange={setFilters}
            onResetFilters={handleResetFilters}
            matchedCount={filteredIdeas.length}
            totalCount={ideas.length}
          />

          {/* Empty Filtered Result State */}
          {filteredIdeas.length === 0 ? (
            <div className="analytics-empty-filter-notice" role="status" data-testid="analytics-no-filter-match">
              <span style={{ fontSize: '2rem' }} aria-hidden="true">🔍</span>
              <h3 className="analytics-empty-filter-title">No Matching Ideas Found</h3>
              <p className="analytics-empty-filter-desc">
                No ideas match the selected date range and category filters. Try widening your filters to view data.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetFilters}
                data-testid="reset-filter-notice-btn"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <>
              {/* Issue #9: Metric Cards Grid */}
              <section
                className="analytics-metrics-grid"
                aria-label="Key idea metric cards"
                data-testid="analytics-metric-cards-grid"
              >
                <AnalyticsMetricCard
                  id="total"
                  label="Total Ideas"
                  value={metrics.totalIdeas}
                  variant="total"
                  icon="💡"
                  percentage={100}
                />
                <AnalyticsMetricCard
                  id="pending-review"
                  label="Pending Review"
                  value={metrics.statusGroups.pendingReview}
                  variant="pending"
                  icon="⏳"
                  percentage={
                    metrics.totalIdeas > 0
                      ? Math.round((metrics.statusGroups.pendingReview / metrics.totalIdeas) * 100)
                      : 0
                  }
                  subtext={`${metrics.statusCounts.Submitted || 0} Submitted • ${metrics.statusCounts['Under Review'] || 0} In Review`}
                />
                <AnalyticsMetricCard
                  id="in-progress"
                  label="In Progress"
                  value={metrics.statusGroups.inProgress}
                  variant="in-progress"
                  icon="⚙️"
                  percentage={
                    metrics.totalIdeas > 0
                      ? Math.round((metrics.statusGroups.inProgress / metrics.totalIdeas) * 100)
                      : 0
                  }
                />
                <AnalyticsMetricCard
                  id="accepted"
                  label="Accepted"
                  value={metrics.statusGroups.accepted}
                  variant="accepted"
                  icon="👍"
                  percentage={
                    metrics.totalIdeas > 0
                      ? Math.round((metrics.statusGroups.accepted / metrics.totalIdeas) * 100)
                      : 0
                  }
                />
                <AnalyticsMetricCard
                  id="implemented"
                  label="Implemented"
                  value={metrics.statusGroups.implemented}
                  variant="implemented"
                  icon="🚀"
                  percentage={
                    metrics.totalIdeas > 0
                      ? Math.round((metrics.statusGroups.implemented / metrics.totalIdeas) * 100)
                      : 0
                  }
                />
                <AnalyticsMetricCard
                  id="rejected"
                  label="Rejected"
                  value={metrics.statusGroups.rejected}
                  variant="rejected"
                  icon="🚫"
                  percentage={
                    metrics.totalIdeas > 0
                      ? Math.round((metrics.statusGroups.rejected / metrics.totalIdeas) * 100)
                      : 0
                  }
                />
              </section>

              {/* Issue #9: Visualizations Grid */}
              <section className="analytics-charts-grid" aria-label="Analytics visual charts">
                <StatusDistributionChart
                  statusCounts={metrics.statusCounts}
                  totalIdeas={metrics.totalIdeas}
                />
                <CategoryDistributionChart
                  categoryCounts={metrics.categoryCounts}
                  totalIdeas={metrics.totalIdeas}
                />
                <div className="analytics-charts-full-row">
                  <SubmissionsTrendChart
                    submissionTrends={metrics.submissionTrends}
                    totalIdeas={metrics.totalIdeas}
                  />
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
