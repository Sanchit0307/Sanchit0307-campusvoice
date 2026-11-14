import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../src/context/AuthContext'
import NotificationBell from '../../src/components/NotificationBell'
import * as notificationService from '../../src/services/notificationService'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('NotificationBell Component Suite', () => {
  const mockUser = {
    uid: 'student-test-123',
    displayName: 'Test Student',
    email: 'student@campus.edu',
  }

  const sampleNotifications = [
    {
      id: 'notif-1',
      recipientId: 'student-test-123',
      ideaId: 'idea-1',
      ideaTitle: 'Campus Wi-Fi',
      message: 'Your idea "Campus Wi-Fi" has been approved.',
      newStatus: 'Approved',
      isRead: false,
      createdAt: 'Just now',
    },
    {
      id: 'notif-2',
      recipientId: 'student-test-123',
      ideaId: 'idea-2',
      ideaTitle: 'Library Desks',
      message: 'Your idea "Library Desks" is now in progress.',
      newStatus: 'In Progress',
      isRead: false,
      createdAt: 'Yesterday',
    },
    {
      id: 'notif-3',
      recipientId: 'student-test-123',
      ideaId: 'idea-3',
      ideaTitle: 'Cafeteria Hours',
      message: 'Your idea "Cafeteria Hours" is now under review.',
      newStatus: 'Under Review',
      isRead: true,
      createdAt: 'Oct 10, 2026',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(notificationService, 'markNotificationAsRead').mockResolvedValue()
    vi.spyOn(notificationService, 'markAllNotificationsAsRead').mockResolvedValue()
  })

  function renderWithAuth(user = mockUser) {
    const authValue = {
      user,
      loading: false,
      isConfigured: true,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn(),
      isModerator: false,
    }

    return render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  it('renders notification bell button with unread badge count', () => {
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(sampleNotifications)
      return () => {}
    })

    renderWithAuth()

    const bellBtn = screen.getByRole('button', { name: /notifications, 2 unread/i })
    expect(bellBtn).toBeInTheDocument()
    expect(bellBtn).toHaveAttribute('aria-expanded', 'false')

    // Badge renders "2"
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders "9+" when unread count exceeds 9', () => {
    const manyUnread = Array.from({ length: 12 }, (_, i) => ({
      id: `notif-${i}`,
      recipientId: 'student-test-123',
      ideaId: `idea-${i}`,
      ideaTitle: `Idea ${i}`,
      message: `Update for idea ${i}`,
      newStatus: 'Under Review',
      isRead: false,
      createdAt: 'Just now',
    }))

    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(manyUnread)
      return () => {}
    })

    renderWithAuth()

    expect(screen.getByText('9+')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notifications, 12 unread/i })).toBeInTheDocument()
  })

  it('does NOT display badge when there are 0 unread notifications', () => {
    const allRead = [
      {
        id: 'notif-1',
        recipientId: 'student-test-123',
        ideaId: 'idea-1',
        message: 'All read',
        isRead: true,
        createdAt: 'Just now',
      },
    ]

    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(allRead)
      return () => {}
    })

    renderWithAuth()

    expect(screen.queryByText('0')).not.toBeInTheDocument()
    const bellBtn = screen.getByRole('button', { name: /^notifications$/i })
    expect(bellBtn).toBeInTheDocument()
  })

  it('opens panel on bell click and closes when clicked again', () => {
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(sampleNotifications)
      return () => {}
    })

    renderWithAuth()

    const bellBtn = screen.getByRole('button', { name: /notifications/i })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(bellBtn)
    expect(screen.getByRole('dialog', { name: /notification center/i })).toBeInTheDocument()
    expect(bellBtn).toHaveAttribute('aria-expanded', 'true')

    // Click to close
    fireEvent.click(bellBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bellBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes panel on pressing Escape key', () => {
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(sampleNotifications)
      return () => {}
    })

    renderWithAuth()

    const bellBtn = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(bellBtn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes panel when clicking outside', () => {
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(sampleNotifications)
      return () => {}
    })

    renderWithAuth()

    const bellBtn = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(bellBtn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click outside on body
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('displays empty state when user has no notifications', () => {
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate([])
      return () => {}
    })

    renderWithAuth()

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument()
    expect(screen.getByText(/when campus moderators update the status/i)).toBeInTheDocument()
  })

  it('displays error state with retry option when subscription fails', () => {
    let subCount = 0
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, _onUpdate, onError) => {
      subCount++
      onError(new Error('Network connection timeout'))
      return () => {}
    })

    renderWithAuth()

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText(/failed to load updates/i)).toBeInTheDocument()
    expect(screen.getByText(/network connection timeout/i)).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /try again/i })
    expect(retryBtn).toBeInTheDocument()
    fireEvent.click(retryBtn)
    expect(subCount).toBe(2)
  })

  it('allows marking all notifications as read', async () => {
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(sampleNotifications)
      return () => {}
    })

    renderWithAuth()

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    const markAllBtn = screen.getByRole('button', { name: /mark all notifications as read/i })
    expect(markAllBtn).toBeEnabled()

    fireEvent.click(markAllBtn)

    await waitFor(() => {
      expect(notificationService.markAllNotificationsAsRead).toHaveBeenCalledWith(['notif-1', 'notif-2'])
    })
  })

  it('marks individual notification as read when clicking its check icon', async () => {
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(sampleNotifications)
      return () => {}
    })

    renderWithAuth()

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    const markSingleButtons = screen.getAllByRole('button', { name: /mark notification as read/i })
    expect(markSingleButtons.length).toBe(2)

    fireEvent.click(markSingleButtons[0])

    await waitFor(() => {
      expect(notificationService.markNotificationAsRead).toHaveBeenCalledWith('notif-1')
    })
    // Did not navigate
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('marks as read, closes panel, and navigates to idea details when selecting a notification', async () => {
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(sampleNotifications)
      return () => {}
    })

    renderWithAuth()

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    const notifItem = screen.getByText('Your idea "Campus Wi-Fi" has been approved.')
    fireEvent.click(notifItem)

    await waitFor(() => {
      expect(notificationService.markNotificationAsRead).toHaveBeenCalledWith('notif-1')
    })
    expect(mockNavigate).toHaveBeenCalledWith('/ideas/idea-1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('handles notification selection with keyboard Enter key', async () => {
    vi.spyOn(notificationService, 'subscribeToUserNotifications').mockImplementation((_uid, onUpdate) => {
      onUpdate(sampleNotifications)
      return () => {}
    })

    renderWithAuth()

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    const notifButton = screen.getAllByRole('button', { name: /notification:/i })[0]
    fireEvent.keyDown(notifButton, { key: 'Enter' })

    await waitFor(() => {
      expect(notificationService.markNotificationAsRead).toHaveBeenCalledWith('notif-1')
    })
    expect(mockNavigate).toHaveBeenCalledWith('/ideas/idea-1')
  })
})
