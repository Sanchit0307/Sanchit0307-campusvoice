import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  calculateUnreadCount,
} from '../services/notificationService'
import './NotificationBell.css'

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.uid

  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [retryTrigger, setRetryTrigger] = useState(0)

  const containerRef = useRef(null)

  const unreadCount = calculateUnreadCount(notifications)
  const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id)

  // Format badge display: empty if 0, 9+ if > 9
  const badgeText = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null

  // Subscribe to real-time notifications for the authenticated user
  useEffect(() => {
    if (!userId) {
      return
    }

    const unsubscribe = subscribeToUserNotifications(
      userId,
      (items) => {
        setNotifications(items)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('Failed to subscribe to notifications:', err)
        setError(err.message || 'Unable to load notifications.')
        setLoading(false)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [userId, retryTrigger])

  // Handle clicking outside to dismiss panel
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const toggleOpen = () => {
    setIsOpen((prev) => !prev)
  }

  const handleRetry = () => {
    setRetryTrigger((prev) => prev + 1)
  }

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await markNotificationAsRead(notif.id)
      } catch (err) {
        console.error('Failed to mark notification read on click:', err)
      }
    }

    setIsOpen(false)

    if (notif.ideaId) {
      navigate(`/ideas/${notif.ideaId}`)
    } else {
      navigate('/ideas')
    }
  }

  const handleMarkItemRead = async (e, notifId) => {
    e.stopPropagation()
    try {
      await markNotificationAsRead(notifId)
    } catch (err) {
      console.error('Failed to mark individual notification read:', err)
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadIds.length === 0 || isMarkingAll) return

    setIsMarkingAll(true)
    try {
      await markAllNotificationsAsRead(unreadIds)
    } catch (err) {
      console.error('Failed to mark all notifications read:', err)
    } finally {
      setIsMarkingAll(false)
    }
  }

  const getStatusChipClass = (status) => {
    const s = (status || '').toLowerCase().replace(/\s+/g, '-')
    return `notification-status-chip status-${s}`
  }

  const accessibleBellLabel = unreadCount > 0
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications'

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button
        type="button"
        className={`notification-bell-btn ${isOpen ? 'is-active' : ''}`}
        onClick={toggleOpen}
        aria-label={accessibleBellLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <svg
          className="notification-bell-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {badgeText && (
          <span className="notification-badge" aria-hidden="true">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notification-panel"
          role="dialog"
          aria-label="Notification center"
          tabIndex={-1}
        >
          {/* Header */}
          <div className="notification-panel-header">
            <div className="notification-panel-title-wrap">
              <h3 className="notification-panel-title">Notifications</h3>
              {unreadCount > 0 ? (
                <span className="notification-count-chip">{unreadCount} new</span>
              ) : (
                <span className="notification-count-chip">All caught up</span>
              )}
            </div>

            <button
              type="button"
              className="notification-mark-all-btn"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || isMarkingAll}
              aria-label="Mark all notifications as read"
            >
              {isMarkingAll ? 'Marking...' : 'Mark all as read'}
            </button>
          </div>

          {/* Body Content */}
          {loading ? (
            <div className="notification-state-wrap" role="status" aria-live="polite">
              <div className="notification-spinner" aria-hidden="true" />
              <div className="notification-state-title">Loading notifications...</div>
              <div className="notification-state-desc">Checking for updates to your proposals.</div>
            </div>
          ) : error ? (
            <div className="notification-state-wrap" role="alert">
              <div className="notification-state-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="notification-state-title">Failed to load updates</div>
              <div className="notification-state-desc">{error}</div>
              <button
                type="button"
                className="notification-retry-btn"
                onClick={handleRetry}
              >
                Try Again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-state-wrap">
              <div className="notification-state-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div className="notification-state-title">No notifications yet</div>
              <div className="notification-state-desc">
                When campus moderators update the status of your submitted ideas, you&apos;ll be notified here.
              </div>
            </div>
          ) : (
            <ul className="notification-panel-list" role="list">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`notification-item ${!item.isRead ? 'is-unread' : ''}`}
                  onClick={() => handleNotificationClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleNotificationClick(item)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${item.isRead ? 'Read' : 'Unread'} notification: ${item.message}`}
                >
                  {!item.isRead ? (
                    <span className="notification-unread-dot" aria-hidden="true" />
                  ) : (
                    <span className="notification-dot-placeholder" aria-hidden="true" />
                  )}

                  <div className="notification-content">
                    <div className="notification-meta">
                      {item.newStatus && (
                        <span className={getStatusChipClass(item.newStatus)}>
                          {item.newStatus}
                        </span>
                      )}
                      <span className="notification-time">{item.createdAt}</span>
                    </div>
                    <p className="notification-message">{item.message}</p>
                  </div>

                  {!item.isRead && (
                    <button
                      type="button"
                      className="notification-mark-item-btn"
                      onClick={(e) => handleMarkItemRead(e, item.id)}
                      title="Mark as read"
                      aria-label="Mark notification as read"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
