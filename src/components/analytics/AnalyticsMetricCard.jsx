import './AnalyticsMetricCard.css'

/**
 * Reusable Metric Card displaying key statistics with visual accents and percentage share.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.label
 * @param {number} props.value
 * @param {string} [props.variant='total'] - 'total' | 'pending' | 'in-progress' | 'accepted' | 'implemented' | 'rejected'
 * @param {string|React.ReactNode} [props.icon='📊']
 * @param {number|null} [props.percentage=null] - Percentage of total ideas
 * @param {string} [props.subtext]
 */
export default function AnalyticsMetricCard({
  id,
  label,
  value = 0,
  variant = 'total',
  icon = '📊',
  percentage = null,
  subtext = '',
}) {
  const formattedValue = typeof value === 'number' && !isNaN(value) ? value.toLocaleString() : '0'

  return (
    <div
      className={`analytics-metric-card metric-${variant}`}
      id={id ? `metric-card-${id}` : undefined}
      data-testid={id ? `metric-card-${id}` : 'analytics-metric-card'}
      role="region"
      aria-label={`${label}: ${formattedValue}`}
    >
      <div
        className={`analytics-metric-icon is-${variant}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="analytics-metric-content">
        <div className="analytics-metric-value-row">
          <span className="analytics-metric-number">{formattedValue}</span>
          {typeof percentage === 'number' && !isNaN(percentage) && (
            <span className="analytics-metric-percent" title={`${percentage}% of total ideas`}>
              ({percentage}%)
            </span>
          )}
        </div>

        <span className="analytics-metric-label">{label}</span>
        {subtext && <span className="analytics-metric-subtext">{subtext}</span>}
      </div>
    </div>
  )
}
