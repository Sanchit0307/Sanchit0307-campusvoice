import { IDEA_CATEGORIES } from '../../services/analyticsService'
import './CategoryDistributionChart.css'

const CATEGORY_ICONS = {
  Academics: '📚',
  'Campus Life': '🎉',
  Dining: '🍽️',
  Facilities: '🏛️',
  Sustainability: '🌱',
  Transportation: '🚌',
  Wellness: '🧘',
  Other: '📦',
}

/**
 * Category Distribution Horizontal Bar Chart.
 *
 * @param {object} props
 * @param {Record<string, number>} props.categoryCounts
 * @param {number} props.totalIdeas
 */
export default function CategoryDistributionChart({ categoryCounts = {}, totalIdeas = 0 }) {
  // Collect all canonical categories + Other (if > 0)
  const items = IDEA_CATEGORIES.map((category) => {
    const count = typeof categoryCounts[category] === 'number' ? categoryCounts[category] : 0
    const percent = totalIdeas > 0 ? Math.round((count / totalIdeas) * 100) : 0
    return {
      category,
      count,
      percent,
      icon: CATEGORY_ICONS[category] || '📌',
      classKey: `category-${category.toLowerCase().replace(/\s+/g, '-')}`,
    }
  })

  if (categoryCounts.Other && categoryCounts.Other > 0) {
    const count = categoryCounts.Other
    const percent = totalIdeas > 0 ? Math.round((count / totalIdeas) * 100) : 0
    items.push({
      category: 'Other',
      count,
      percent,
      icon: CATEGORY_ICONS.Other,
      classKey: 'category-other',
    })
  }

  // Sort by count descending so most popular categories appear on top
  const sortedItems = [...items].sort((a, b) => b.count - a.count)

  const isEmpty = totalIdeas === 0

  return (
    <figure
      className="analytics-chart-card"
      id="category-distribution-chart"
      data-testid="category-distribution-chart"
      aria-labelledby="category-chart-title"
    >
      <div className="analytics-chart-header">
        <h3 id="category-chart-title" className="analytics-chart-title">
          <span>🏛️ Ideas by Category</span>
        </h3>
        <span className="analytics-chart-subtitle">
          {items.length} campus categories
        </span>
      </div>

      {isEmpty ? (
        <div className="chart-empty-state" role="status">
          <div className="chart-empty-icon" aria-hidden="true">📭</div>
          <p className="chart-empty-text">No ideas found for the selected view.</p>
        </div>
      ) : (
        <div className="category-chart-body" role="list" aria-label="Ideas categorized by topic">
          {sortedItems.map((item) => (
            <div
              key={item.category}
              className={`category-row ${item.classKey}`}
              role="listitem"
              data-testid={`category-row-${item.category.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="category-row-header">
                <span className="category-label">
                  <span className="category-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.category}</span>
                </span>
                <span className="category-count-badge">
                  {item.count} ({item.percent}%)
                </span>
              </div>

              <div
                className="category-track"
                role="progressbar"
                aria-valuenow={item.count}
                aria-valuemin="0"
                aria-valuemax={totalIdeas}
                aria-label={`${item.category}: ${item.count} ideas (${item.percent}%)`}
              >
                <div
                  className="category-fill"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}

          {/* Screen reader accessible table */}
          <table className="sr-only">
            <caption>Idea category distribution</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Count</th>
                <th scope="col">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.category}>
                  <td>{item.category}</td>
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
