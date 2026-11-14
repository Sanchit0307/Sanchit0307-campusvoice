import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SubmitIdeaPage from '../../src/pages/SubmitIdeaPage'
import { AuthContext } from '../../src/context/AuthContext'
import { createIdea } from '../../src/services/ideasService'

vi.mock('../../src/services/ideasService', () => ({
  createIdea: vi.fn(),
  toggleUpvote: vi.fn(),
  hasUserUpvoted: vi.fn().mockResolvedValue(false),
}))

describe('SubmitIdeaPage Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderSubmitPage(authOverrides = {}) {
    const authContextValue = {
      user: { uid: 'student_tester_1', displayName: 'Alex Student' },
      loading: false,
      authError: null,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn(),
      isConfigured: true,
      isModerator: false,
      ...authOverrides,
    }

    return render(
      <MemoryRouter>
        <AuthContext.Provider value={authContextValue}>
          <SubmitIdeaPage />
        </AuthContext.Provider>
      </MemoryRouter>
    )
  }

  it('renders expected form fields, labels, and action buttons', () => {
    renderSubmitPage()

    expect(screen.getByRole('heading', { name: /submit a campus idea/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/idea title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit proposal/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cancel/i })).toBeInTheDocument()
  })

  it('shows validation error messages and prevents service call on invalid submit', () => {
    renderSubmitPage()

    const submitBtn = screen.getByRole('button', { name: /submit proposal/i })
    fireEvent.click(submitBtn)

    // Validation messages for empty required fields
    expect(screen.getByText('Please enter an idea title.')).toBeInTheDocument()
    expect(screen.getByText('Please select a category for your idea.')).toBeInTheDocument()
    expect(screen.getByText('Please provide a description of your proposal.')).toBeInTheDocument()

    // createIdea service should never be called on rejected validation
    expect(createIdea).not.toHaveBeenCalled()
  })

  it('clears specific field validation error when the user edits that field', () => {
    renderSubmitPage()

    // Trigger validation errors
    fireEvent.click(screen.getByRole('button', { name: /submit proposal/i }))
    expect(screen.getByText('Please enter an idea title.')).toBeInTheDocument()
    expect(screen.getByText('Please select a category for your idea.')).toBeInTheDocument()

    // Type into Title field
    const titleInput = screen.getByLabelText(/idea title/i)
    fireEvent.change(titleInput, { target: { name: 'title', value: 'New Proposal Title' } })

    // Title error should be cleared, but category error remains
    expect(screen.queryByText('Please enter an idea title.')).not.toBeInTheDocument()
    expect(screen.getByText('Please select a category for your idea.')).toBeInTheDocument()
  })

  it('displays an error alert banner when idea submission fails', async () => {
    createIdea.mockRejectedValue(new Error('Database write permission denied'))
    renderSubmitPage()

    fireEvent.change(screen.getByLabelText(/idea title/i), {
      target: { name: 'title', value: '24/7 Library Wing' },
    })
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { name: 'category', value: 'Facilities' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: {
        name: 'description',
        value: 'Keep the quiet wing on the second floor open 24 hours during midterms and finals.',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /submit proposal/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Database write permission denied')).toBeInTheDocument()
    })
  })

  it('displays the success confirmation state upon successful submission', async () => {
    const mockCreatedIdea = {
      id: 'idea-created-999',
      title: 'Solar Panels on Student Union',
      category: 'Sustainability',
      description: 'Install solar collectors to lower campus energy bills and charge student laptops.',
      authorName: 'Alex Student',
      authorId: 'student_tester_1',
      status: 'Submitted',
      upvoteCount: 0,
      createdAt: 'Just now',
    }
    createIdea.mockResolvedValue(mockCreatedIdea)
    renderSubmitPage()

    fireEvent.change(screen.getByLabelText(/idea title/i), {
      target: { name: 'title', value: 'Solar Panels on Student Union' },
    })
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { name: 'category', value: 'Sustainability' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: {
        name: 'description',
        value: 'Install solar collectors to lower campus energy bills and charge student laptops.',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /submit proposal/i }))

    await waitFor(() => {
      expect(screen.getByText('Idea Submitted Successfully!')).toBeInTheDocument()
      expect(screen.getByText('Proposal Preview')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /view in ideas feed/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /\+ submit another idea/i })).toBeInTheDocument()
    })
  })

  it('resets form back to editable state when clicking "+ Submit Another Idea"', async () => {
    createIdea.mockResolvedValue({
      id: 'idea-created-1',
      title: 'Test Proposal Title',
      category: 'Facilities',
      description: 'Long enough description for testing proposal reset.',
      status: 'Submitted',
      upvoteCount: 0,
    })
    renderSubmitPage()

    // Fill and submit
    fireEvent.change(screen.getByLabelText(/idea title/i), {
      target: { name: 'title', value: 'Test Proposal Title' },
    })
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { name: 'category', value: 'Facilities' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: {
        name: 'description',
        value: 'Long enough description for testing proposal reset.',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit proposal/i }))

    await waitFor(() => {
      expect(screen.getByText('Idea Submitted Successfully!')).toBeInTheDocument()
    })

    // Click "+ Submit Another Idea"
    const submitAnotherBtn = screen.getByRole('button', { name: /\+ submit another idea/i })
    fireEvent.click(submitAnotherBtn)

    // Form is restored and fields are empty
    expect(screen.getByLabelText(/idea title/i)).toHaveValue('')
    expect(screen.getByLabelText(/category/i)).toHaveValue('')
    expect(screen.getByLabelText(/description/i)).toHaveValue('')
    expect(screen.queryByText('Idea Submitted Successfully!')).not.toBeInTheDocument()
  })
})
