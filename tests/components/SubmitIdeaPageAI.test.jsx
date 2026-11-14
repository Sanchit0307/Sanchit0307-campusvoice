import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SubmitIdeaPage from '../../src/pages/SubmitIdeaPage'
import { AuthContext } from '../../src/context/AuthContext'
import { createIdea } from '../../src/services/ideasService'
import * as aiService from '../../src/services/aiService'

vi.mock('../../src/services/ideasService', () => ({
  createIdea: vi.fn(),
  toggleUpvote: vi.fn(),
  hasUserUpvoted: vi.fn().mockResolvedValue(false),
}))

describe('SubmitIdeaPage AI Category Suggestion Suite', () => {
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

  it('renders "Suggest Category" button and keeps it disabled until title and description reach minimum lengths', () => {
    renderSubmitPage()

    const suggestBtn = screen.getByRole('button', { name: /suggest category/i })
    expect(suggestBtn).toBeInTheDocument()
    expect(suggestBtn).toBeDisabled()

    // Title only (not enough)
    const titleInput = screen.getByLabelText(/idea title/i)
    fireEvent.change(titleInput, { target: { name: 'title', value: 'New Campus Gym Equipment' } })
    expect(suggestBtn).toBeDisabled()

    // Short description (< 10 chars, still disabled)
    const descInput = screen.getByLabelText(/description/i)
    fireEvent.change(descInput, { target: { name: 'description', value: 'Too short' } })
    expect(suggestBtn).toBeDisabled()

    // Description >= 10 chars (now enabled)
    fireEvent.change(descInput, {
      target: { name: 'description', value: 'Add more cardio machines and dumbbells to the student fitness center.' },
    })
    expect(suggestBtn).not.toBeDisabled()
  })

  it('successfully suggests category, preselects dropdown, and displays reasoning', async () => {
    vi.spyOn(aiService, 'suggestCategory').mockResolvedValue({
      category: 'Wellness',
      confidence: 0.95,
      reasoning: 'Proposes new fitness equipment for student wellness and mental health.',
    })

    renderSubmitPage()

    const titleInput = screen.getByLabelText(/idea title/i)
    const descInput = screen.getByLabelText(/description/i)
    const select = screen.getByLabelText(/category/i)

    fireEvent.change(titleInput, { target: { name: 'title', value: 'New Gym Equipment' } })
    fireEvent.change(descInput, {
      target: { name: 'description', value: 'Install more treadmills and free weights in the main campus recreational gym.' },
    })

    expect(select.value).toBe('')

    const suggestBtn = screen.getByRole('button', { name: /suggest category/i })
    fireEvent.click(suggestBtn)

    await waitFor(() => {
      // Dropdown was preselected
      expect(select.value).toBe('Wellness')
      // Suggestion badge is rendered
      expect(screen.getByText(/AI Suggestion:/i)).toBeInTheDocument()
      expect(screen.getByText(/95% match/i)).toBeInTheDocument()
      expect(
        screen.getByText('Proposes new fitness equipment for student wellness and mental health.')
      ).toBeInTheDocument()
    })

    expect(aiService.suggestCategory).toHaveBeenCalledTimes(1)
  })

  it('shows loading indicator and prevents duplicate clicks while request is in progress', async () => {
    let resolveAiCall
    const pendingPromise = new Promise((resolve) => {
      resolveAiCall = resolve
    })

    vi.spyOn(aiService, 'suggestCategory').mockReturnValue(pendingPromise)

    renderSubmitPage()

    fireEvent.change(screen.getByLabelText(/idea title/i), {
      target: { name: 'title', value: 'Solar Rooftops' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { name: 'description', value: 'Install solar panels across library and dorm roofs.' },
    })

    const suggestBtn = screen.getByRole('button', { name: /suggest category/i })
    fireEvent.click(suggestBtn)

    // Button shows analyzing state and is disabled
    expect(screen.getByText('Analyzing...')).toBeInTheDocument()
    expect(suggestBtn).toBeDisabled()

    // Second click does nothing
    fireEvent.click(suggestBtn)
    expect(aiService.suggestCategory).toHaveBeenCalledTimes(1)

    // Resolve the promise
    resolveAiCall({
      category: 'Sustainability',
      confidence: 0.98,
      reasoning: 'Solar panels promote renewable campus energy.',
    })

    await waitFor(() => {
      expect(screen.queryByText('Analyzing...')).not.toBeInTheDocument()
      expect(screen.getByText('Suggest Category')).toBeInTheDocument()
      expect(screen.getByLabelText(/category/i).value).toBe('Sustainability')
    })
  })

  it('allows student to manually override the AI suggestion before submitting', async () => {
    vi.spyOn(aiService, 'suggestCategory').mockResolvedValue({
      category: 'Sustainability',
      confidence: 0.9,
      reasoning: 'Solar charging stations.',
    })

    renderSubmitPage()

    fireEvent.change(screen.getByLabelText(/idea title/i), {
      target: { name: 'title', value: 'Outdoor Study Benches with Solar' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { name: 'description', value: 'Place quiet study benches with solar outlets outside.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /suggest category/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/category/i).value).toBe('Sustainability')
    })

    // Student overrides selection to "Facilities"
    const select = screen.getByLabelText(/category/i)
    fireEvent.change(select, { target: { name: 'category', value: 'Facilities' } })

    expect(select.value).toBe('Facilities')
    // Badge shows "Manually Changed"
    expect(screen.getByText('Manually Changed')).toBeInTheDocument()
  })

  it('handles AI suggestion failure gracefully without blocking normal idea submission', async () => {
    vi.spyOn(aiService, 'suggestCategory').mockRejectedValue(
      new Error('AI service quota reached. Please select a category manually.')
    )

    createIdea.mockResolvedValue({
      id: 'idea-created-manual',
      title: 'Healthy Cafeteria Meals',
      category: 'Dining',
      description: 'Offer organic salad bowls and allergen-free meal options daily.',
      authorName: 'Alex Student',
      authorId: 'student_tester_1',
      status: 'Submitted',
      upvoteCount: 0,
    })

    renderSubmitPage()

    fireEvent.change(screen.getByLabelText(/idea title/i), {
      target: { name: 'title', value: 'Healthy Cafeteria Meals' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { name: 'description', value: 'Offer organic salad bowls and allergen-free meal options daily.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /suggest category/i }))

    await waitFor(() => {
      expect(screen.getByText(/AI service quota reached/i)).toBeInTheDocument()
    })

    // Dismiss the notice
    const dismissBtn = screen.getByRole('button', { name: /dismiss error notice/i })
    fireEvent.click(dismissBtn)
    expect(screen.queryByText(/AI service quota reached/i)).not.toBeInTheDocument()

    // Student manually selects category and submits
    fireEvent.change(screen.getByLabelText(/category/i), { target: { name: 'category', value: 'Dining' } })
    fireEvent.click(screen.getByRole('button', { name: /submit proposal/i }))

    await waitFor(() => {
      expect(createIdea).toHaveBeenCalledTimes(1)
      expect(createIdea).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Healthy Cafeteria Meals',
          category: 'Dining',
          description: 'Offer organic salad bowls and allergen-free meal options daily.',
        })
      )
      expect(screen.getByText('Idea Submitted Successfully!')).toBeInTheDocument()
    })
  })

  it('prevents stale responses from overwriting newer form state if inputs changed', async () => {
    let resolveFirstCall
    const firstPromise = new Promise((resolve) => {
      resolveFirstCall = resolve
    })

    vi.spyOn(aiService, 'suggestCategory').mockReturnValue(firstPromise)

    renderSubmitPage()

    const titleInput = screen.getByLabelText(/idea title/i)
    const descInput = screen.getByLabelText(/description/i)
    const suggestBtn = screen.getByRole('button', { name: /suggest category/i })

    // User triggers suggestion for "Library Desks"
    fireEvent.change(titleInput, { target: { name: 'title', value: 'Library Desks' } })
    fireEvent.change(descInput, { target: { name: 'description', value: 'More quiet desks in library building.' } })
    fireEvent.click(suggestBtn)

    // While request is in-flight, user edits title and description to something else
    fireEvent.change(titleInput, { target: { name: 'title', value: 'Weekend Shuttles' } })
    fireEvent.change(descInput, { target: { name: 'description', value: 'Need late night shuttles to campus.' } })
    // User also selects Dining manually
    fireEvent.change(screen.getByLabelText(/category/i), { target: { name: 'category', value: 'Dining' } })

    // Now late first call resolves with "Facilities" for the old "Library Desks"
    resolveFirstCall({
      category: 'Facilities',
      confidence: 0.9,
      reasoning: 'Old request resolved late.',
    })

    // Wait and verify that stale response did NOT overwrite user's edited state
    await waitFor(() => {
      expect(screen.getByLabelText(/category/i).value).toBe('Dining')
    })
  })
})
