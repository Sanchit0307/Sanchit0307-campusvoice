import './SubmissionsTrendChart.css'

function formatTrendDateLabel(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const d = new Date(year, month, day)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }
  return dateStr
}

/**
 * Submissions Over Time Trend Chart.
 *
 * @param {object} props
 * @param {Array<{ date: string, count: number }>} props.submissionTrends
 * @param {number} props.totalIdeas
 */
export default function SubmissionsTrendChart({ submissionTrends = [], totalIdeas = 0 }) {
  const safeTrends = Array.isArray(submissionTrends) ? submissionTrends : []
  const maxCount = safeTrends.reduce((max, item) => Math.max(max, item.count), 0)
  const totalSubmissionsInTrends = safeTrends.reduce((sum, item) => sum + item.count, 0)
  const activeDays = safeTrends.filter((item) => item.count > 0).length

  const isEmpty = safeTrends.length === 0 || totalSubmissionsInTrends === 0

  return (
    <figure
      className="analytics-chart-card"
      id="submissions-trend-chart"
      data-testid="submissions-trend-chart"
      aria-labelledby="trend-chart-title"
    >
      <div className="analytics-chart-header">
        <h3 id="trend-chart-title" className="analytics-chart-title">
          <span>📈 Submissions Over Time</span>
        </h3>
        <span className="analytics-chart-subtitle">
          {totalIdeas > 0 ? `${totalIdeas} total • ` : ''}{safeTrends.length} active {safeTrends.length === 1 ? 'date' : 'dates'}
        </span>
      </div>

      {!isEmpty && (
        <div className="trend-chart-summary" aria-label="Trend summary highlights">
          <div className="trend-summary-item">
            <span className="trend-summary-label">Total in Trend:</span>
            <span className="trend-summary-val">{totalSubmissionsInTrends}</span>
          </div>
          <div className="trend-summary-item">
            <span className="trend-summary-label">Peak Daily Volume:</span>
            <span className="trend-summary-val">{maxCount} ideas/day</span>
          </div>
          <div className="trend-summary-item">
            <span className="trend-summary-label">Active Days:</span>
            <span className="trend-summary-val">{activeDays}</span>
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="chart-empty-state" role="status">
          <div className="chart-empty-icon" aria-hidden="true">📅</div>
          <p className="chart-empty-text">No idea submissions found for the selected timeline.</p>
        </div>
      ) : (
        <div className="trend-scroll-wrapper" role="region" aria-label="Interactive timeline graph">
          <div className="trend-bars-container" role="graphics-document" aria-label="Submissions per day bar chart">
            {safeTrends.map((item) => {
              const heightPercent = maxCount > 0 ? Math.max(8, Math.round((item.count / maxCount) * 100)) : 8
              const readableDate = formatTrendDateLabel(item.date)

              return (
                <div
                  key={item.date}
                  className="trend-bar-column"
                  data-testid={`trend-column-${item.date}`}
                  title={`${readableDate}: ${item.count} ${item.count === 1 ? 'idea' : 'ideas'}`}
                >
                  <span className="trend-bar-count">{item.count}</span>

                  <div
                    className="trend-bar-track"
                    role="progressbar"
                    aria-valuenow={item.count}
                    aria-valuemin="0"
                    aria-valuemax={maxCount}
                    aria-label={`${readableDate}: ${item.count} ideas`}
                  >
                    <div
                      className="trend-bar-fill"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  <span className="trend-bar-date">{readableDate}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Screen reader accessible table */}
      {!isEmpty && (
        <table className="sr-only">
          <caption>Idea submissions over time</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Submissions</th>
            </tr>
          </thead>
          <tbody>
            {safeTrends.map((item) => (
              <tr key={item.date}>
                <td>{formatTrendDateLabel(item.date)}</td>
                <td>{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  )
}
