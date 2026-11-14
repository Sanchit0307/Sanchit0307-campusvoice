import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { suggestCategory } from '../../src/services/aiService'

function mockJsonResponse(data, status = 200, ok = true) {
  return {
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

function mockHtmlResponse(html, status = 200, ok = true) {
  return {
    ok,
    status,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0')
    },
    text: async () => html,
  }
}

describe('aiService - suggestCategory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects with error if title is shorter than 3 characters', async () => {
    global.fetch = vi.fn()
    await expect(
      suggestCategory({ title: 'ab', description: 'This is a long enough description.' })
    ).rejects.toThrow('Please enter a title of at least 3 characters')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects with error if description is shorter than 10 characters', async () => {
    global.fetch = vi.fn()
    await expect(
      suggestCategory({ title: 'Valid Title', description: 'Too short' })
    ).rejects.toThrow('Please enter a description of at least 10 characters')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('makes POST request to /api/suggest-category with trimmed inputs', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        category: 'Sustainability',
        confidence: 0.95,
        reasoning: 'Proposes solar panels on campus.',
      })
    )

    const result = await suggestCategory({
      title: '  Solar Roofs  ',
      description: '  Install solar panels on academic buildings.  ',
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('/api/suggest-category', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Solar Roofs',
        description: 'Install solar panels on academic buildings.',
      }),
      signal: undefined,
    })

    expect(result).toEqual({
      category: 'Sustainability',
      confidence: 0.95,
      reasoning: 'Proposes solar panels on campus.',
    })
  })

  it('throws server error message if response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse(
        {
          error: 'AI service quota reached. Please select a category manually.',
        },
        429,
        false
      )
    )

    await expect(
      suggestCategory({
        title: 'More study desks in library',
        description: 'Library is overcrowded during midterm examinations.',
      })
    ).rejects.toThrow('AI service quota reached. Please select a category manually.')
  })

  it('throws friendly error if network fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    await expect(
      suggestCategory({
        title: 'More study desks in library',
        description: 'Library is overcrowded during midterm examinations.',
      })
    ).rejects.toThrow('Unable to connect to the suggestion service')
  })

  it('catches and reports HTML responses when frontend hits SPA fallback instead of API backend', async () => {
    // Regression test for issue where /api hits Vite without proxy and returns index.html
    global.fetch = vi.fn().mockResolvedValue(
      mockHtmlResponse('<!DOCTYPE html><html><head><title>CampusVoice</title></head><body><div id="root"></div></body></html>')
    )

    await expect(
      suggestCategory({
        title: 'More study desks in library',
        description: 'Library is overcrowded during midterm examinations.',
      })
    ).rejects.toThrow('The suggestion endpoint returned an HTML page instead of JSON. Ensure your API server is running at http://127.0.0.1:3000.')
  })

  it('detects lowercase <!doctype html> SPA fallback and returns helpful diagnostic error', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockHtmlResponse('<!doctype html><html lang="en"><head><script type="module"></script></head><body><div id="root"></div></body></html>')
    )

    await expect(
      suggestCategory({
        title: 'More study desks in library',
        description: 'Library is overcrowded during midterm examinations.',
      })
    ).rejects.toThrow('The suggestion endpoint returned an HTML page instead of JSON. Ensure your API server is running at http://127.0.0.1:3000.')
  })

  it('handles empty non-JSON response with default unreadable error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers({ 'content-type': 'text/plain' }),
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
      text: async () => '',
    })

    await expect(
      suggestCategory({
        title: 'More study desks in library',
        description: 'Library is overcrowded during midterm examinations.',
      })
    ).rejects.toThrow('Received an unreadable response from the server. Please select a category manually.')
  })

  it('sanitizes and truncates plain-text non-JSON error responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers({ 'content-type': 'text/plain' }),
      json: async () => {
        throw new SyntaxError('Unexpected token B in JSON at position 0')
      },
      text: async () => '502 Bad Gateway: Upstream service did not respond in time',
    })

    await expect(
      suggestCategory({
        title: 'More study desks in library',
        description: 'Library is overcrowded during midterm examinations.',
      })
    ).rejects.toThrow('502 Bad Gateway: Upstream service did not respond in time')
  })

  it('throws friendly error if server response is application/json but has unparseable content', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => {
        throw new SyntaxError('Malformed JSON')
      },
      text: async () => '{ bad json',
    })

    await expect(
      suggestCategory({
        title: 'More study desks in library',
        description: 'Library is overcrowded during midterm examinations.',
      })
    ).rejects.toThrow('Received an unreadable JSON response from the server')
  })

  it('throws friendly error if server response lacks category field', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse({}))

    await expect(
      suggestCategory({
        title: 'More study desks in library',
        description: 'Library is overcrowded during midterm examinations.',
      })
    ).rejects.toThrow('No category recommendation was received')
  })

  it('re-throws AbortError when request is cancelled', async () => {
    const abortErr = new Error('The operation was aborted')
    abortErr.name = 'AbortError'
    global.fetch = vi.fn().mockRejectedValue(abortErr)

    const controller = new AbortController()
    controller.abort()

    await expect(
      suggestCategory({
        title: 'More study desks in library',
        description: 'Library is overcrowded during midterm examinations.',
        signal: controller.signal,
      })
    ).rejects.toThrow('The operation was aborted')
  })
})
