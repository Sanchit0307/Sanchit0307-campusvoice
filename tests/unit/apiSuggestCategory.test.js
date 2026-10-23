import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler, {
  VALID_CATEGORIES,
  _resetRateLimits,
  resolveGeminiApiKey,
} from '../../api/suggest-category.js'

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader: vi.fn((key, value) => {
      res.headers[key.toLowerCase()] = value
      return res
    }),
    status: vi.fn((code) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((data) => {
      res.body = data
      return res
    }),
  }
  return res
}

describe('Vercel Serverless Function: /api/suggest-category', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    _resetRateLimits()
    process.env = { ...originalEnv }
    process.env.GEMINI_API_KEY = 'test-mock-secret-key-12345'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('HTTP Method Enforcement', () => {
    it('rejects GET requests with 405 Method Not Allowed and sets Allow header', async () => {
      const req = { method: 'GET', headers: {} }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST')
      expect(res.body).toEqual({ error: 'Method Not Allowed. Use POST.' })
    })

    it('rejects PUT and DELETE requests with 405', async () => {
      for (const method of ['PUT', 'DELETE', 'PATCH']) {
        const req = { method, headers: {} }
        const res = createMockRes()

        await handler(req, res)

        expect(res.status).toHaveBeenCalledWith(405)
      }
    })
  })

  describe('Server Configuration & Secret Isolation', () => {
    it('returns 503 if GEMINI_API_KEY is not configured', async () => {
      delete process.env.GEMINI_API_KEY
      const req = {
        method: 'POST',
        headers: {},
        body: { title: 'Quiet Library Study Wing', description: 'Extend hours during finals week for students.' },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(503)
      expect(res.body).toEqual({
        error: 'AI suggestion service is not configured on the server.',
      })
    })

    it('never leaks the secret API key in the response body or headers', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Internal network explosion'))

      const req = {
        method: 'POST',
        headers: {},
        body: { title: 'Solar Powered Charging Benches', description: 'Install outdoor benches with USB solar charging.' },
      }
      const res = createMockRes()

      await handler(req, res)

      const stringifiedBody = JSON.stringify(res.body)
      expect(stringifiedBody).not.toContain('test-mock-secret-key-12345')
      expect(res.status).toHaveBeenCalledWith(500)
    })

    it('resolves GEMINI_API_KEY directly when set in process.env', () => {
      process.env.GEMINI_API_KEY = 'explicit-env-key-999'
      expect(resolveGeminiApiKey()).toBe('explicit-env-key-999')
    })

    it('resolves GEMINI_API_KEY from project root .env.local file when opted into file fallback', () => {
      delete process.env.GEMINI_API_KEY
      const resolved = resolveGeminiApiKey({ allowFileFallbackInTest: true })
      expect(typeof resolved).toBe('string')
      expect(resolved.length).toBeGreaterThan(10)
    })
  })

  describe('Input Validation & Constraints', () => {
    it('rejects missing or empty title with 400', async () => {
      const req = {
        method: 'POST',
        headers: {},
        body: { title: '  ', description: 'A detailed description that meets length requirements.' },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.body.error).toContain('Idea title must be a valid text string')
    })

    it('rejects titles longer than 100 characters with 400', async () => {
      const req = {
        method: 'POST',
        headers: {},
        body: {
          title: 'A'.repeat(101),
          description: 'A detailed description that meets length requirements.',
        },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.body.error).toContain('Idea title or description exceeds permitted length limit')
    })

    it('rejects descriptions shorter than 10 characters with 400', async () => {
      const req = {
        method: 'POST',
        headers: {},
        body: { title: 'Valid Title', description: 'Too short' },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.body.error).toContain('Idea description must be a valid text string of at least 10 characters')
    })

    it('rejects descriptions longer than 2000 characters with 400', async () => {
      const req = {
        method: 'POST',
        headers: {},
        body: { title: 'Valid Title', description: 'A'.repeat(2001) },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.body.error).toContain('Idea title or description exceeds permitted length limit')
    })
  })

  describe('Warm Instance Rate Limiting', () => {
    it('throttles client IP when exceeding 10 requests within window with 429', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ category: 'Facilities', confidence: 0.95, reasoning: 'Direct facilities request.' }) }] } }],
        }),
      })

      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.100' },
        body: { title: 'Library Study Desks', description: 'Need more study desks in building B.' },
      }

      // First 10 requests pass
      for (let i = 0; i < 10; i++) {
        const res = createMockRes()
        await handler(req, res)
        expect(res.status).toHaveBeenCalledWith(200)
      }

      // 11th request fails with 429
      const throttledRes = createMockRes()
      await handler(req, throttledRes)
      expect(throttledRes.status).toHaveBeenCalledWith(429)
      expect(throttledRes.body.error).toContain('Rate limit exceeded')
    })
  })

  describe('Gemini API Integration & Category Validation', () => {
    it('returns a valid category with confidence and reasoning on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'Sustainability',
                      confidence: 0.92,
                      reasoning: 'Proposes solar panels on campus roofs to reduce carbon footprint.',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })

      const req = {
        method: 'POST',
        headers: {},
        body: {
          title: 'Solar Panels on Academic Complex',
          description: 'Install photovoltaic solar panels on roof of Engineering block.',
        },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body).toEqual({
        category: 'Sustainability',
        confidence: 0.92,
        reasoning: 'Proposes solar panels on campus roofs to reduce carbon footprint.',
      })
      expect(VALID_CATEGORIES).toContain(res.body.category)
    })

    it('rejects hallucinated or non-whitelisted categories with 422', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'RandomNonExistentCategory',
                      confidence: 0.9,
                      reasoning: 'Some made up category.',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })

      const req = {
        method: 'POST',
        headers: {},
        body: {
          title: 'Extraterrestrial Studies',
          description: 'Add UFO research lab to the observatory center.',
        },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.body.error).toContain('AI suggestion did not match an allowed campus category')
    })

    it('handles upstream 429 quota exhaustion gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Resource exhausted' } }),
      })

      const req = {
        method: 'POST',
        headers: {},
        body: { title: 'New Dining Menu Items', description: 'Introduce more vegan and gluten-free wraps.' },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.body.error).toContain('AI service quota reached')
    })

    it('handles upstream abort / timeout with 504', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      global.fetch = vi.fn().mockRejectedValue(abortError)

      const req = {
        method: 'POST',
        headers: {},
        body: { title: 'Shuttle Tracker GPS App', description: 'Live bus location tracking for students.' },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(504)
      expect(res.body.error).toContain('AI request timed out')
    })

    it('falls back to alternative model if primary model returns 503 busy or 404', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'High demand' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        category: 'Transportation',
                        confidence: 0.94,
                        reasoning: 'Shuttle bus proposals belong to campus transportation.',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        })

      const req = {
        method: 'POST',
        headers: {},
        body: { title: 'Weekend Night Shuttle', description: 'Run late buses from campus dorms to the station.' },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch.mock.calls[1][0]).toContain('models/gemini-3.5-flash:')
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body.category).toBe('Transportation')
    })

    it('classifies unusual research and technical proposals (e.g. satellite research) into Academics', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'Academics',
                      confidence: 0.95,
                      reasoning: 'Satellite development is an academic engineering research project.',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })

      const req = {
        method: 'POST',
        headers: {},
        body: {
          title: 'Launch a student satellite for research',
          description: 'Develop a small CubeSat satellite for academic atmospheric research and request engineering faculty funding.',
        },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body.category).toBe('Academics')
      expect(res.body.confidence).toBe(0.95)
      expect(res.body.reasoning).toContain('academic engineering')
    })

    it('classifies club-focused proposals into Campus Life', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'Campus Life',
                      confidence: 0.9,
                      reasoning: 'Student club activities and gatherings belong to Campus Life.',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })

      const req = {
        method: 'POST',
        headers: {},
        body: {
          title: 'Student Satellite Enthusiasts Club',
          description: 'Establish a new student organization hosting weekend stargazing and space discussion meetups.',
        },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body.category).toBe('Campus Life')
    })

    it('handles safety block finishReason gracefully with HTTP 422', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              finishReason: 'SAFETY',
              content: { parts: [] },
            },
          ],
        }),
      })

      const req = {
        method: 'POST',
        headers: {},
        body: {
          title: 'Controversial Topic Presentation',
          description: 'Host an open microphone presentation discussing prohibited materials.',
        },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.body.error).toContain('content safety')
    })

    it('returns sanitized 502 error if both primary and fallback models fail', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Primary model unavailable',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Fallback model unavailable',
        })

      const req = {
        method: 'POST',
        headers: {},
        body: {
          title: 'Improve campus Wi-Fi',
          description: 'Wi-Fi connectivity in dorms and classrooms needs upgrading.',
        },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(res.status).toHaveBeenCalledWith(502)
      expect(res.body.error).toBe('Upstream AI provider error. Please select a category manually.')
    })

    it('ensures upstream fetch call never sends an Expect header', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'Wellness',
                      confidence: 0.9,
                      reasoning: 'Mental health and wellness programs.',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })

      const req = {
        method: 'POST',
        headers: { expect: '100-continue' }, // Incoming caller header
        body: { title: 'Counseling Center Expansion', description: 'Add more certified student counselors.' },
      }
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      const outgoingHeaders = global.fetch.mock.calls[0][1].headers
      expect(outgoingHeaders).toEqual({ 'Content-Type': 'application/json' })
      expect(outgoingHeaders.expect).toBeUndefined()
      expect(outgoingHeaders.Expect).toBeUndefined()
    })
  })
})
