import { IDEA_CATEGORIES, DATE_RANGE_OPTIONS } from '../../services/analyticsService'
import './AnalyticsFilterBar.css'

/**
 * Filter Bar for Moderator Analytics Dashboard.
 *
 * @param {object} props
 * @param {object} props.filters
 * @param {string} props.filters.dateRange
 * @param {string} props.filters.category
 * @param {string} props.filters.customStartDate
 * @param {string} props.filters.customEndDate
 * @param {(updater: (prev: object) => object) => void} props.onFilterChange
 * @param {() => void} props.onResetFilters
 * @param {number} props.matchedCount
 * @param {number} props.totalCount
 */
export default function AnalyticsFilterBar({
  filters,
  onFilterChange,
  onResetFilters,
  matchedCount,
  totalCount,
}) {
  const {
    dateRange = 'all',
    category = 'All',
    customStartDate = '',
    customEndDate = '',
  } = filters

  const isFiltered =
    dateRange !== 'all' ||
    category !== 'All' ||
    Boolean(customStartDate) ||
    Boolean(customEndDate)

  const activeFiltersCount =
    (dateRange !== 'all' ? 1 : 0) +
    (category !== 'All' ? 1 : 0) +
    (dateRange === 'custom' && (customStartDate || customEndDate) ? 1 : 0)

  return (
    <section
      className="analytics-filter-card"
      id="analytics-filter-bar"
      data-testid="analytics-filter-bar"
      aria-label="Analytics Filters"
    >
      <div className="analytics-filter-header">
        <div className="analytics-filter-title">
          <span>🔍 Filter Analytics Data</span>
          <span className="analytics-filter-count-label">
            ({matchedCount} of {totalCount} ideas)
          </span>
          {isFiltered && (
            <span className="analytics-filter-active-count" data-testid="active-filter-badge">
              {activeFiltersCount} active
            </span>
          )}
        </div>

        {isFiltered && (
          <button
            type="button"
            className="analytics-filter-reset-btn"
            onClick={onResetFilters}
            data-testid="analytics-reset-filters-btn"
            aria-label="Reset all analytics filters to defaults"
          >
            <span>↺</span>
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      <div className="analytics-filter-controls">
        {/* Date Range Presets */}
        <div className="analytics-filter-group">
          <label className="analytics-filter-label" id="date-range-filter-label">
            Date Range
          </label>
          <div
            className="analytics-date-pills"
            role="radiogroup"
            aria-labelledby="date-range-filter-label"
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={dateRange === opt.id}
                className={`analytics-date-pill ${dateRange === opt.id ? 'active' : ''}`}
                onClick={() =>
                  onFilterChange((prev) => ({
                    ...prev,
                    dateRange: opt.id,
                  }))
                }
                data-testid={`date-pill-${opt.id}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Inputs */}
          {dateRange === 'custom' && (
            <div className="analytics-custom-date-row" data-testid="custom-date-inputs">
              <input
                type="date"
                className="analytics-date-input"
                aria-label="Start Date"
                value={customStartDate}
                onChange={(e) =>
                  onFilterChange((prev) => ({
                    ...prev,
                    customStartDate: e.target.value,
                  }))
                }
                data-testid="custom-start-date"
              />
              <span className="analytics-date-separator">to</span>
              <input
                type="date"
                className="analytics-date-input"
                aria-label="End Date"
                value={customEndDate}
                onChange={(e) =>
                  onFilterChange((prev) => ({
                    ...prev,
                    customEndDate: e.target.value,
                  }))
                }
                data-testid="custom-end-date"
              />
            </div>
          )}
        </div>

        {/* Category Dropdown */}
        <div className="analytics-filter-group">
          <label htmlFor="analytics-category-select" className="analytics-filter-label">
            Category
          </label>
          <select
            id="analytics-category-select"
            className="analytics-filter-select"
            value={category}
            onChange={(e) =>
              onFilterChange((prev) => ({
                ...prev,
                category: e.target.value,
              }))
            }
            data-testid="analytics-category-select"
          >
            <option value="All">All Categories ({totalCount})</option>
            {IDEA_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}
