import { IDEA_STATUSES } from '../../services/analyticsService'
import './StatusDistributionChart.css'

const STATUS_CLASS_MAP = {
  Submitted: 'color-submitted',
  'Under Review': 'color-under-review',
  'In Progress': 'color-in-progress',
  Accepted: 'color-accepted',
  Implemented: 'color-implemented',
  Rejected: 'color-rejected',
  Other: 'color-other',
}

/**
 * Status Distribution Donut & Legend Chart.
 *
 * @param {object} props
 * @param {Record<string, number>} props.statusCounts
 * @param {number} props.totalIdeas
 */
export default function StatusDistributionChart({ statusCounts = {}, totalIdeas = 0 }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius // ~251.327

  // Collect displayable statuses (canonical + Other if > 0)
  const items = IDEA_STATUSES.map((status) => {
    const count = typeof statusCounts[status] === 'number' ? statusCounts[status] : 0
    const percent = totalIdeas > 0 ? Math.round((count / totalIdeas) * 100) : 0
    return {
      status,
      count,
      percent,
      colorClass: STATUS_CLASS_MAP[status] || 'color-other',
    }
  })

  if (statusCounts.Other && statusCounts.Other > 0) {
    const count = statusCounts.Other
    const percent = totalIdeas > 0 ? Math.round((count / totalIdeas) * 100) : 0
    items.push({
      status: 'Other',
      count,
      percent,
      colorClass: 'color-other',
    })
  }

  // Calculate SVG stroke offset for donut segments
  const segments = items
    .filter((item) => item.count > 0)
    .reduce(
      (acc, item) => {
        const strokeLength = (item.count / totalIdeas) * circumference
        const strokeOffset = -(acc.cumulative * circumference)
        acc.list.push({
          ...item,
          strokeDasharray: `${strokeLength} ${circumference - strokeLength}`,
          strokeDashoffset: strokeOffset,
        })
        acc.cumulative += item.count / totalIdeas
        return acc
      },
      { list: [], cumulative: 0 }
    ).list

  const isEmpty = totalIdeas === 0

  return (
    <figure
      className="analytics-chart-card"
      id="status-distribution-chart"
      data-testid="status-distribution-chart"
      aria-labelledby="status-chart-title"
    >
      <div className="analytics-chart-header">
        <h3 id="status-chart-title" className="analytics-chart-title">
          <span>📊 Idea Status Breakdown</span>
        </h3>
        <span className="analytics-chart-subtitle">
          {totalIdeas} total {totalIdeas === 1 ? 'idea' : 'ideas'}
        </span>
      </div>

      {isEmpty ? (
        <div className="chart-empty-state" role="status">
          <div className="chart-empty-icon" aria-hidden="true">📭</div>
          <p className="chart-empty-text">No ideas found for the selected view.</p>
        </div>
      ) : (
        <div className="status-chart-body">
          {/* Donut Chart SVG */}
          <div className="status-donut-container" aria-hidden="true">
            <svg
              className="status-donut-svg"
              viewBox="0 0 100 100"
              width="180"
              height="180"
            >
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="var(--color-border-subtle, #f1f5f9)"
                strokeWidth="18"
              />
              {/* Segments */}
              {segments.map((seg) => (
                <circle
                  key={seg.status}
                  cx="50"
                  cy="50"
                  r={radius}
                  className={`status-donut-segment ${seg.colorClass}`}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                />
              ))}
            </svg>
            <div className="status-donut-center">
              <span className="donut-center-total">{totalIdeas}</span>
              <span className="donut-center-label">Total</span>
            </div>
          </div>

          {/* Accessible Data List / Legend */}
          <div className="status-legend-grid" role="list" aria-label="Status distribution statistics">
            {items.map((item) => (
              <div
                key={item.status}
                className="status-legend-item"
                role="listitem"
                data-testid={`legend-status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div
                  className={`status-legend-dot ${item.colorClass}`}
                  aria-hidden="true"
                />
                <div className="status-legend-info">
                  <span className="status-legend-name">{item.status}</span>
                  <span className="status-legend-stats">
                    {item.count} ({item.percent}%)
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Screen reader accessible table */}
          <table className="sr-only">
            <caption>Idea status distribution</caption>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Count</th>
                <th scope="col">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.status}>
                  <td>{item.status}</td>
                  <td>{item.count}</td>
                  <td>{item.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}
