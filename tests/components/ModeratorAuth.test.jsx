import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { checkIsModerator } from '../../src/services/ideasService'
import Navbar from '../../src/components/Navbar'
import DashboardPage from '../../src/pages/DashboardPage'
import { AuthContext } from '../../src/context/AuthContext'
import * as firestore from 'firebase/firestore'

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    doc: vi.fn((_db, col, id) => ({ path: `${col}/${id}` })),
    getDoc: vi.fn(),
  }
})

vi.mock('../../src/services/ideasService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getUserIdeas: vi.fn().mockResolvedValue([]),
    getIdeas: vi.fn().mockResolvedValue([]),
  }
})

describe('Moderator Authorization & Dashboard Visibility Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkIsModerator Service Logic', () => {
    it('recognizes an authenticated moderator with canonical lowercase role', async () => {
      firestore.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'moderator' }),
      })

      const isMod = await checkIsModerator('mod_user_123')
      expect(isMod).toBe(true)
    })

    it('recognizes an authenticated moderator with capitalized or padded role ("Moderator ")', async () => {
      firestore.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: '  Moderator  ' }),
      })

      const isMod = await checkIsModerator('mod_user_capitalized')
      expect(isMod).toBe(true)
    })

    it('recognizes an authenticated moderator when field is named "Role" instead of "role"', async () => {
      firestore.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ Role: 'moderator' }),
      })

      const isMod = await checkIsModerator('mod_user_alias')
      expect(isMod).toBe(true)
    })

    it('does not recognize a regular student (non-moderator role or missing doc)', async () => {
      firestore.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'student' }),
      })

      const isModStudent = await checkIsModerator('student_user_1')
      expect(isModStudent).toBe(false)

      firestore.getDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      })

      const isModMissing = await checkIsModerator('non_existent_doc')
      expect(isModMissing).toBe(false)
    })

    it('rejects signed-out visitor or null/empty UID immediately without querying', async () => {
      expect(await checkIsModerator(null)).toBe(false)
      expect(await checkIsModerator(undefined)).toBe(false)
      expect(await checkIsModerator('')).toBe(false)
      expect(await checkIsModerator('   ')).toBe(false)
      expect(firestore.getDoc).not.toHaveBeenCalled()
    })

    it('fails safely when Firestore getDoc throws an unexpected error', async () => {
      firestore.getDoc.mockRejectedValueOnce(new Error('Internal Firestore connection failed'))

      const isMod = await checkIsModerator('error_user')
      expect(isMod).toBe(false)
    })

    it('retries once and succeeds if permission-denied occurred during initial token propagation', async () => {
      const permissionError = new Error('Permission denied')
      permissionError.code = 'permission-denied'

      firestore.getDoc
        .mockRejectedValueOnce(permissionError)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ role: 'moderator' }),
        })

      const isMod = await checkIsModerator('retry_user')
      expect(isMod).toBe(true)
      expect(firestore.getDoc).toHaveBeenCalledTimes(2)
    })
  })

  describe('Navbar Visibility by Role', () => {
    function renderNavbar(authValues) {
      return render(
        <MemoryRouter>
          <AuthContext.Provider value={authValues}>
            <Navbar />
          </AuthContext.Provider>
        </MemoryRouter>
      )
    }

    it('shows Staff badge and Moderation navigation link for authenticated moderator', () => {
      renderNavbar({
        user: { uid: 'mod_uid', displayName: 'Prof. Miller' },
        isModerator: true,
        loading: false,
        isConfigured: true,
        signInWithGoogle: vi.fn(),
        signOutUser: vi.fn(),
      })

      expect(screen.getByText('Prof. Miller')).toBeInTheDocument()
      expect(screen.getByText('Staff')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /moderation/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    })

    it('hides Staff badge and Moderation link for ordinary authenticated student', () => {
      renderNavbar({
        user: { uid: 'student_uid', displayName: 'Sam Student' },
        isModerator: false,
        loading: false,
        isConfigured: true,
        signInWithGoogle: vi.fn(),
        signOutUser: vi.fn(),
      })

      expect(screen.getByText('Sam Student')).toBeInTheDocument()
      expect(screen.queryByText('Staff')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /moderation/i })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    })

    it('hides moderator privileges for unauthenticated guest', () => {
      renderNavbar({
        user: null,
        isModerator: false,
        loading: false,
        isConfigured: true,
        signInWithGoogle: vi.fn(),
        signOutUser: vi.fn(),
      })

      expect(screen.queryByText('Staff')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /moderation/i })).not.toBeInTheDocument()
    })
  })

  describe('Dashboard Access & Protection', () => {
    function renderDashboard(authValues, initialEntry = '/dashboard') {
      return render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <AuthContext.Provider value={authValues}>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/moderation" element={<DashboardPage />} />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      )
    }

    it('allows an authorized moderator to access the Moderation Queue via tab or ?tab=moderation-queue', async () => {
      renderDashboard(
        {
          user: { uid: 'mod_uid', displayName: 'Staff Sarah' },
          isModerator: true,
          loading: false,
          isConfigured: true,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn(),
        },
        '/dashboard?tab=moderation-queue'
      )

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /moderation queue/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /campus moderation queue/i })).toBeInTheDocument()
      })
    })

    it('protects the Moderation Queue from an ordinary student even if ?tab=moderation-queue is requested', async () => {
      renderDashboard(
        {
          user: { uid: 'student_uid', displayName: 'Alex Student' },
          isModerator: false,
          loading: false,
          isConfigured: true,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn(),
        },
        '/dashboard?tab=moderation-queue'
      )

      await waitFor(() => {
        // Tab switcher is hidden from regular students
        expect(screen.queryByRole('tab', { name: /moderation queue/i })).not.toBeInTheDocument()
        // Content remains student dashboard, not moderation queue
        expect(screen.queryByText(/campus moderation queue/i)).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /alex student's dashboard/i })).toBeInTheDocument()
      })
    })
  })
})
