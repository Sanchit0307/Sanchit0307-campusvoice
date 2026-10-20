import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProfilePage from '../../src/pages/ProfilePage'
import { AuthContext } from '../../src/context/AuthContext'
import { getUserIdeas } from '../../src/services/ideasService'
import {
  getUserProfile,
  saveUserProfile,
} from '../../src/services/profileService'

vi.mock('../../src/services/ideasService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getUserIdeas: vi.fn(),
  }
})

vi.mock('../../src/services/profileService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getUserProfile: vi.fn(),
    saveUserProfile: vi.fn(),
  }
})

describe('ProfilePage Component Suite (Milestone 5: Profile, Activity & Editing)', () => {
  const sampleUser = {
    uid: 'student_123',
    displayName: 'Alex Morgan',
    email: 'alex.morgan@campus.edu',
    photoURL: 'https://example.com/alex.jpg',
  }

  const sampleProfile = {
    uid: 'student_123',
    displayName: 'Alex Morgan',
    email: 'alex.morgan@campus.edu',
    bio: 'Passionate student advocate for campus library resources.',
    department: 'Computer Science',
    year: 'Junior (Class of 2027)',
    createdAt: { seconds: 1700000000 },
    updatedAt: { seconds: 1700000100 },
  }

  const sampleIdeas = [
    {
      id: 'idea-1',
      title: '24/7 Library Study Lounge Access',
      description: 'Extend library hours during finals week with campus card access.',
      category: 'Facilities',
      authorId: 'student_123',
      authorName: 'Alex Morgan',
      status: 'Under Review',
      upvoteCount: 15,
      upvotes: 15,
      hasUpvoted: false,
      createdAt: 'Oct 10, 2026',
      updatedAt: 'Oct 12, 2026',
    },
    {
      id: 'idea-2',
      title: 'Solar Benches on Campus Quad',
      description: 'Install weatherproof solar benches with charging outlets.',
      category: 'Sustainability',
      authorId: 'student_123',
      authorName: 'Alex Morgan',
      status: 'Accepted',
      upvoteCount: 30,
      upvotes: 30,
      hasUpvoted: true,
      createdAt: 'Oct 14, 2026',
      updatedAt: 'Oct 15, 2026',
    },
    {
      id: 'idea-3',
      title: 'Compost Bins in Dining Hall',
      description: 'Add clearly-labeled organic composting bins in all student dining halls.',
      category: 'Dining',
      authorId: 'student_123',
      authorName: 'Alex Morgan',
      status: 'Submitted',
      upvoteCount: 5,
      upvotes: 5,
      hasUpvoted: false,
      createdAt: 'Oct 18, 2026',
      updatedAt: 'Oct 18, 2026',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUserProfile).mockResolvedValue(sampleProfile)
    vi.mocked(getUserIdeas).mockResolvedValue(sampleIdeas)
  })

  function renderProfilePage(
    {
      user = sampleUser,
      loading = false,
      isModerator = false,
      signInWithGoogle = vi.fn().mockResolvedValue(sampleUser),
      isConfigured = true,
    } = {},
    rerenderFn = null
  ) {
    const authContextValue = {
      user,
      loading,
      isModerator,
      signInWithGoogle,
      isConfigured,
      signOutUser: vi.fn(),
      authError: null,
      isRoleLoading: false,
      roleResolved: true,
      refreshModeratorStatus: vi.fn(),
    }

    const ui = (
      <AuthContext.Provider value={authContextValue}>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/submit" element={<div>Submit Idea Destination</div>} />
            <Route path="/ideas/:id" element={<div>Idea Detail Destination</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    if (rerenderFn) {
      rerenderFn(ui)
      return null
    }

    return render(ui)
  }

  describe('Issue #11: Student Profile Page Rendering', () => {
    it('1. Renders student profile with avatar photo, display name, verified email, and badges', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
      })

      expect(screen.getByText('alex.morgan@campus.edu')).toBeInTheDocument()
      expect(screen.getByText(/verified/i)).toBeInTheDocument()
      expect(screen.getByText('Student')).toBeInTheDocument()
      expect(screen.getByText(/computer science/i)).toBeInTheDocument()
      expect(screen.getByText(/junior \(class of 2027\)/i)).toBeInTheDocument()
      expect(
        screen.getByText('Passionate student advocate for campus library resources.')
      ).toBeInTheDocument()

      const avatarImg = screen.getByAltText('Alex Morgan')
      expect(avatarImg).toHaveAttribute('src', 'https://example.com/alex.jpg')
    })

    it('2. Gracefully falls back to initials when user has no photoURL', async () => {
      const userWithoutPhoto = {
        ...sampleUser,
        photoURL: null,
      }
      renderProfilePage({ user: userWithoutPhoto })

      await waitFor(() => {
        expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
      })

      // AM initials displayed in avatar placeholder
      expect(screen.getByText('AM')).toBeInTheDocument()
    })

    it('3. Gracefully supports legacy users who have no profile document yet', async () => {
      vi.mocked(getUserProfile).mockResolvedValueOnce(null)
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
      })

      // Shows biography placeholder prompting student to add bio
      expect(
        screen.getByText(/no biography provided yet/i)
      ).toBeInTheDocument()
    })

    it('4. Displays Staff Moderator badge when authenticated user is a moderator', async () => {
      renderProfilePage({ isModerator: true })

      await waitFor(() => {
        expect(screen.getByText('Staff Moderator')).toBeInTheDocument()
      })
    })

    it('5. Displays sign-in prompt when visitor is unauthenticated', () => {
      renderProfilePage({ user: null })

      expect(screen.getByRole('heading', { name: /student profile/i })).toBeInTheDocument()
      expect(
        screen.getByText(/sign in with your campus google account to access your student profile/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    })

    it('6. Displays checking authentication state during auth resolution', () => {
      renderProfilePage({ loading: true, user: null })

      expect(screen.getByText(/loading profile\.\.\./i)).toBeInTheDocument()
      expect(screen.getByText(/verifying your student identity/i)).toBeInTheDocument()
    })

    it('7. Calculates real activity summary metrics from submitted Firestore ideas', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument() // 3 ideas total
      })

      expect(screen.getByText('Submitted Ideas')).toBeInTheDocument()
      const ones = screen.getAllByText('1')
      expect(ones.length).toBeGreaterThanOrEqual(2) // 1 Under Review and 1 Accepted
      expect(screen.getAllByText('Under Review').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Accepted / In Progress')).toBeInTheDocument()
      // Total upvotes: 15 + 30 + 5 = 50
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('Community Upvotes')).toBeInTheDocument()
    })

    it('8. Shows profile loading error banner with retry button on failure', async () => {
      vi.mocked(getUserProfile).mockRejectedValueOnce(new Error('Network error loading profile'))
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText(/network error loading profile/i)).toBeInTheDocument()
      })

      const retryBtn = screen.getByRole('button', { name: /retry/i })
      expect(retryBtn).toBeInTheDocument()

      vi.mocked(getUserProfile).mockResolvedValueOnce(sampleProfile)
      fireEvent.click(retryBtn)

      await waitFor(() => {
        expect(getUserProfile).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Issue #12: Student Idea Activity', () => {
    it('9. Queries only the authenticated user\'s ideas using authorId UID', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(getUserIdeas).toHaveBeenCalledWith('student_123')
      })

      expect(screen.getByText('24/7 Library Study Lounge Access')).toBeInTheDocument()
      expect(screen.getByText('Solar Benches on Campus Quad')).toBeInTheDocument()
      expect(screen.getByText('Compost Bins in Dining Hall')).toBeInTheDocument()
    })

    it('10. Renders canonical statuses and category badges for each user idea', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('24/7 Library Study Lounge Access')).toBeInTheDocument()
      })

      expect(screen.getByText('Facilities')).toBeInTheDocument()
      expect(screen.getByText('Sustainability')).toBeInTheDocument()
      expect(screen.getByText('Dining')).toBeInTheDocument()
    })

    it('11. Filters user ideas by status tab selection', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('24/7 Library Study Lounge Access')).toBeInTheDocument()
      })

      // Click "Under Review" filter tab
      const underReviewTab = screen.getByRole('tab', { name: /under review/i })
      fireEvent.click(underReviewTab)

      expect(screen.getByText('24/7 Library Study Lounge Access')).toBeInTheDocument()
      expect(screen.queryByText('Solar Benches on Campus Quad')).not.toBeInTheDocument()
      expect(screen.queryByText('Compost Bins in Dining Hall')).not.toBeInTheDocument()

      // Click "All" tab to restore
      const allTab = screen.getByRole('tab', { name: /all \(3\)/i })
      fireEvent.click(allTab)

      expect(screen.getByText('24/7 Library Study Lounge Access')).toBeInTheDocument()
      expect(screen.getByText('Solar Benches on Campus Quad')).toBeInTheDocument()
    })

    it('12. Renders empty state with submit CTA when student has submitted 0 ideas', async () => {
      vi.mocked(getUserIdeas).mockResolvedValueOnce([])
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText(/no ideas submitted yet/i)).toBeInTheDocument()
      })

      expect(
        screen.getByText(/you haven't posted any campus improvement ideas yet/i)
      ).toBeInTheDocument()
      const submitLinks = screen.getAllByRole('link', { name: /submit an idea/i })
      expect(submitLinks.length).toBeGreaterThanOrEqual(1)
      expect(submitLinks[0]).toHaveAttribute('href', '/submit')
    })

    it('13. Shows ideas fetch error banner with retry button on network failure', async () => {
      vi.mocked(getUserIdeas).mockRejectedValueOnce(new Error('Firestore network timeout'))
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText(/failed to load ideas/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/firestore network timeout/i)).toBeInTheDocument()
      const retryBtn = screen.getByRole('button', { name: /retry/i })

      vi.mocked(getUserIdeas).mockResolvedValueOnce(sampleIdeas)
      fireEvent.click(retryBtn)

      await waitFor(() => {
        expect(getUserIdeas).toHaveBeenCalledTimes(2)
      })
    })

    it('14. Allows navigation to idea details page from activity cards', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('24/7 Library Study Lounge Access')).toBeInTheDocument()
      })

      const detailLinks = screen.getAllByRole('link', { name: /view details/i })
      expect(detailLinks[0]).toHaveAttribute('href', '/ideas/idea-1')
    })

    it('14b. Searches user ideas by keyword and filters results reactively', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('24/7 Library Study Lounge Access')).toBeInTheDocument()
      })

      const searchInput = screen.getByLabelText(/search your submitted proposals/i)
      fireEvent.change(searchInput, { target: { value: 'Solar' } })

      expect(screen.getByText('Solar Benches on Campus Quad')).toBeInTheDocument()
      expect(screen.queryByText('24/7 Library Study Lounge Access')).not.toBeInTheDocument()
      expect(screen.queryByText('Compost Bins in Dining Hall')).not.toBeInTheDocument()

      // Clear search button restores list
      const clearBtn = screen.getByRole('button', { name: /clear search query/i })
      fireEvent.click(clearBtn)

      expect(screen.getByText('24/7 Library Study Lounge Access')).toBeInTheDocument()
      expect(screen.getByText('Solar Benches on Campus Quad')).toBeInTheDocument()
    })

    it('14c. Sorts user ideas by upvotes on demand', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('24/7 Library Study Lounge Access')).toBeInTheDocument()
      })

      const sortSelect = screen.getByLabelText(/sort your submitted proposals/i)
      fireEvent.change(sortSelect, { target: { value: 'upvotes' } })

      const detailLinks = screen.getAllByRole('link', { name: /view details/i })
      // sampleIdeas: idea-2 has 30 upvotes, idea-1 has 15, idea-3 has 5
      expect(detailLinks[0]).toHaveAttribute('href', '/ideas/idea-2')
      expect(detailLinks[1]).toHaveAttribute('href', '/ideas/idea-1')
      expect(detailLinks[2]).toHaveAttribute('href', '/ideas/idea-3')
    })
  })

  describe('Issue #13: Profile Editing & Privacy Controls', () => {
    it('15. Toggles edit form when clicking Edit Profile button', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('profile-edit-button'))

      expect(screen.getByRole('heading', { name: /edit student profile/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/display name/i)).toHaveValue('Alex Morgan')
      expect(screen.getByLabelText(/campus email/i)).toBeDisabled()
      expect(screen.getByLabelText(/biography/i)).toHaveValue(
        'Passionate student advocate for campus library resources.'
      )
    })

    it('16. Validates client-side constraints and prevents submission with invalid values', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('profile-edit-button'))

      const nameInput = screen.getByLabelText(/display name/i)
      fireEvent.change(nameInput, { target: { value: ' ' } })

      const saveBtn = screen.getByTestId('profile-save-button')
      fireEvent.click(saveBtn)

      expect(await screen.findByText(/display name is required/i)).toBeInTheDocument()
      expect(saveUserProfile).not.toHaveBeenCalled()
    })

    it('17. Enforces read-only identity email and explains Firebase Auth management', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('profile-edit-button'))

      const emailInput = screen.getByLabelText(/campus email/i)
      expect(emailInput).toBeDisabled()
      expect(emailInput).toHaveAttribute('readonly')
      expect(
        screen.getByText(/identity email is managed directly by firebase authentication/i)
      ).toBeInTheDocument()
    })

    it('18. Successfully saves profile edits, updates state, and shows success alert', async () => {
      vi.mocked(saveUserProfile).mockResolvedValueOnce({
        uid: 'student_123',
        displayName: 'Alex M. Updated',
        bio: 'Updated bio information.',
        department: 'Data Science',
        year: 'Senior',
      })

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('profile-edit-button'))

      const nameInput = screen.getByLabelText(/display name/i)
      const bioInput = screen.getByLabelText(/biography/i)
      const deptInput = screen.getByLabelText(/academic department/i)

      fireEvent.change(nameInput, { target: { value: 'Alex M. Updated' } })
      fireEvent.change(bioInput, { target: { value: 'Updated bio information.' } })
      fireEvent.change(deptInput, { target: { value: 'Data Science' } })

      const saveBtn = screen.getByTestId('profile-save-button')
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(saveUserProfile).toHaveBeenCalledWith(
          'student_123',
          expect.objectContaining({
            displayName: 'Alex M. Updated',
            bio: 'Updated bio information.',
            department: 'Data Science',
          }),
          expect.any(Object)
        )
      })

      expect(await screen.findByText(/profile updated successfully/i)).toBeInTheDocument()
      expect(screen.getByText('Alex M. Updated')).toBeInTheDocument()
      expect(screen.getByText('Updated bio information.')).toBeInTheDocument()
    })

    it('19. Displays error notice if saveUserProfile rejects with Firestore error', async () => {
      vi.mocked(saveUserProfile).mockRejectedValueOnce(
        new Error('Permission denied. You can only modify your own permitted profile fields.')
      )

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('profile-edit-button'))

      const saveBtn = screen.getByTestId('profile-save-button')
      fireEvent.click(saveBtn)

      expect(
        await screen.findByText(/permission denied\. you can only modify your own permitted profile fields/i)
      ).toBeInTheDocument()
    })

    it('20. Cancelling edit mode reverts unsaved changes and exits form', async () => {
      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('profile-edit-button'))

      const nameInput = screen.getByLabelText(/display name/i)
      fireEvent.change(nameInput, { target: { value: 'Unsaved Temporary Name' } })

      const cancelBtn = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelBtn)

      // Edit form is closed
      expect(screen.queryByRole('heading', { name: /edit student profile/i })).not.toBeInTheDocument()
      // Original display name is preserved
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
      expect(screen.queryByText('Unsaved Temporary Name')).not.toBeInTheDocument()
    })
  })

  describe('Milestone 5 Regression Tests: Account Switching & Async Race Safety', () => {
    it('21. Resets state immediately, shows loading, and discards stale in-flight requests when switching users', async () => {
      let resolveUserAProfile, resolveUserAIdeas
      let resolveUserBProfile, resolveUserBIdeas

      const userA = { uid: 'user_A', displayName: 'User A', email: 'userA@campus.edu' }
      const userB = { uid: 'user_B', displayName: 'User B', email: 'userB@campus.edu' }

      const profileA = { uid: 'user_A', displayName: 'User A', email: 'userA@campus.edu', department: 'Art' }
      const profileB = { uid: 'user_B', displayName: 'User B', email: 'userB@campus.edu', department: 'Math' }

      const ideasA = [{ id: 'idea-A', title: 'Idea A Title', status: 'Submitted', upvoteCount: 1, category: 'Campus' }]
      const ideasB = [{ id: 'idea-B', title: 'Idea B Title', status: 'Under Review', upvoteCount: 5, category: 'Facilities' }]

      vi.mocked(getUserProfile).mockImplementation((uid) => {
        if (uid === 'user_A') {
          return new Promise((resolve) => {
            resolveUserAProfile = () => resolve(profileA)
          })
        }
        if (uid === 'user_B') {
          return new Promise((resolve) => {
            resolveUserBProfile = () => resolve(profileB)
          })
        }
        return Promise.resolve(null)
      })

      vi.mocked(getUserIdeas).mockImplementation((uid) => {
        if (uid === 'user_A') {
          return new Promise((resolve) => {
            resolveUserAIdeas = () => resolve(ideasA)
          })
        }
        if (uid === 'user_B') {
          return new Promise((resolve) => {
            resolveUserBIdeas = () => resolve(ideasB)
          })
        }
        return Promise.resolve([])
      })

      // 1. Initial render with user A
      const { rerender } = renderProfilePage({ user: userA })

      // User A requests are still pending, so loading state is shown
      expect(screen.getByText(/loading profile details\.\.\./i)).toBeInTheDocument()
      expect(screen.getByText(/loading your ideas\.\.\./i)).toBeInTheDocument()

      // 2. Before user A requests resolve, user switches to user B
      renderProfilePage({ user: userB }, rerender)

      // State is reset and loading indicators remain visible for user B
      expect(screen.getByText(/loading profile details\.\.\./i)).toBeInTheDocument()
      expect(screen.getByText(/loading your ideas\.\.\./i)).toBeInTheDocument()
      expect(screen.queryByText('Idea A Title')).not.toBeInTheDocument()

      // 3. Stale user A requests now resolve late
      await act(async () => {
        resolveUserAProfile()
        resolveUserAIdeas()
        await new Promise((r) => setTimeout(r, 20))
      })

      // Crucial: User A's data must NOT have leaked onto the screen!
      expect(screen.queryByText('User A')).not.toBeInTheDocument()
      expect(screen.queryByText('Idea A Title')).not.toBeInTheDocument()

      // 4. Now user B requests resolve
      await act(async () => {
        resolveUserBProfile()
        resolveUserBIdeas()
      })

      await waitFor(() => {
        expect(screen.getByText('User B')).toBeInTheDocument()
      })
      expect(screen.getByText('Idea B Title')).toBeInTheDocument()
      expect(screen.queryByText('Idea A Title')).not.toBeInTheDocument()
    })

    it('22. Logging out while requests are pending clears profile/ideas and shows guest state without leaks', async () => {
      let resolveUserAProfile, resolveUserAIdeas
      const userA = { uid: 'user_A', displayName: 'User A', email: 'userA@campus.edu' }

      vi.mocked(getUserProfile).mockImplementation(() => new Promise((resolve) => {
        resolveUserAProfile = () => resolve({ uid: 'user_A', displayName: 'User A' })
      }))
      vi.mocked(getUserIdeas).mockImplementation(() => new Promise((resolve) => {
        resolveUserAIdeas = () => resolve([{ id: 'a1', title: 'Pending Idea A', status: 'Submitted' }])
      }))

      const { rerender } = renderProfilePage({ user: userA })

      // User logs out while fetches are pending
      renderProfilePage({ user: null }, rerender)

      expect(screen.getByRole('heading', { name: /student profile/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()

      // Now delayed responses resolve
      await act(async () => {
        resolveUserAProfile()
        resolveUserAIdeas()
        await new Promise((r) => setTimeout(r, 20))
      })

      // Should still be in guest state, no data leaks
      expect(screen.queryByText('User A')).not.toBeInTheDocument()
      expect(screen.queryByText('Pending Idea A')).not.toBeInTheDocument()
    })

    it('23. Resets status filter and active edit mode when switching authenticated accounts', async () => {
      const userA = { uid: 'user_A', displayName: 'User A', email: 'userA@campus.edu' }
      const userB = { uid: 'user_B', displayName: 'User B', email: 'userB@campus.edu' }

      vi.mocked(getUserProfile).mockImplementation((uid) => Promise.resolve({
        uid,
        displayName: uid === 'user_A' ? 'User A' : 'User B',
        bio: 'Bio of ' + uid,
      }))
      vi.mocked(getUserIdeas).mockImplementation((uid) => Promise.resolve([
        { id: `${uid}-1`, title: `${uid} Idea 1`, status: 'Under Review', upvoteCount: 2, category: 'General' },
      ]))

      const { rerender } = renderProfilePage({ user: userA })

      await waitFor(() => {
        expect(screen.getByText('User A')).toBeInTheDocument()
      })

      // Enter edit mode
      fireEvent.click(screen.getByTestId('profile-edit-button'))
      expect(screen.getByRole('heading', { name: /edit student profile/i })).toBeInTheDocument()

      // Click filter tab
      const underReviewTab = screen.getByRole('tab', { name: /under review/i })
      fireEvent.click(underReviewTab)
      expect(underReviewTab).toHaveClass('is-active')

      // Now switch to User B
      renderProfilePage({ user: userB }, rerender)

      await waitFor(() => {
        expect(screen.getByText('User B')).toBeInTheDocument()
      })

      // Edit mode should be closed
      expect(screen.queryByRole('heading', { name: /edit student profile/i })).not.toBeInTheDocument()

      // Filter should be reset to 'All'
      const allTab = screen.getByRole('tab', { name: /all \(1\)/i })
      expect(allTab).toHaveClass('is-active')
    })

    it('24. Rapid account switching (A -> B -> A) safely supersedes intermediate requests and older responses', async () => {
      let resolveA1, resolveB, resolveA2
      const userA = { uid: 'user_A', displayName: 'User A' }
      const userB = { uid: 'user_B', displayName: 'User B' }

      let callCountA = 0
      vi.mocked(getUserProfile).mockImplementation((uid) => {
        if (uid === 'user_A') {
          callCountA++
          if (callCountA === 1) {
            return new Promise((resolve) => {
              resolveA1 = () => resolve({ uid: 'user_A', displayName: 'Stale A1 Name' })
            })
          }
          return new Promise((resolve) => {
            resolveA2 = () => resolve({ uid: 'user_A', displayName: 'Fresh A2 Name' })
          })
        }
        return new Promise((resolve) => {
          resolveB = () => resolve({ uid: 'user_B', displayName: 'User B Name' })
        })
      })
      vi.mocked(getUserIdeas).mockResolvedValue([])

      // Render A
      const { rerender } = renderProfilePage({ user: userA })

      // Quickly switch to B
      renderProfilePage({ user: userB }, rerender)

      // Quickly switch back to A
      renderProfilePage({ user: userA }, rerender)

      // Resolve stale A1 and B responses
      await act(async () => {
        resolveA1()
        resolveB()
        await new Promise((r) => setTimeout(r, 20))
      })

      // Stale A1 and B must not be shown
      expect(screen.queryByText('Stale A1 Name')).not.toBeInTheDocument()
      expect(screen.queryByText('User B Name')).not.toBeInTheDocument()

      // Resolve fresh A2
      await act(async () => {
        resolveA2()
      })
      await waitFor(() => {
        expect(screen.getByText('Fresh A2 Name')).toBeInTheDocument()
      })
    })
  })
})

