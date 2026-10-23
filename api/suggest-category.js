/**
 * Vercel Serverless Function: /api/suggest-category
 *
 * Secure server-side endpoint for proposing an idea category using Google Gemini API.
 * Reads GEMINI_API_KEY exclusively from server-side environment variables.
 *
 * NOTE ON RATE LIMITING:
 * The in-memory sliding-window limiter implemented here is a BEST-EFFORT burst protection
 * scoped to individual warm serverless instances (preventing rapid-fire client loops).
 * Because serverless functions scale across ephemeral stateless containers, this does NOT
 * serve as a globally synchronized security control across distributed instances.
 */

import fs from 'node:fs'
import path from 'node:path'

export const VALID_CATEGORIES = [
  'Academics',
  'Campus Life',
  'Dining',
  'Facilities',
  'Sustainability',
  'Transportation',
  'Wellness',
]

const REQUEST_TIMEOUT_MS = 25000 // 25 seconds timeout for upstream AI call
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10

// Best-effort in-memory cache for warm container burst throttling
const rateLimitMap = new Map()

/**
 * Resolves the Gemini API key from server-side environment variables.
 * In local development, if process.env.GEMINI_API_KEY was not pre-populated by the runner,
 * safely falls back to reading from .env.local or .env in the project root.
 * Under no circumstances is the key logged, printed, or sent to the client.
 */
export function resolveGeminiApiKey(options = {}) {
  if (
    process.env.GEMINI_API_KEY &&
    typeof process.env.GEMINI_API_KEY === 'string' &&
    process.env.GEMINI_API_KEY.trim() !== ''
  ) {
    return process.env.GEMINI_API_KEY.trim()
  }

  // Preserve test isolation when running under test runners unless explicitly opted in
  if (process.env.VITEST && !options.allowFileFallbackInTest) {
    return null
  }

  // Local development fallback: load from project root .env.local or .env
  for (const envFile of ['.env.local', '.env']) {
    try {
      const fullPath = path.resolve(process.cwd(), envFile)
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8')
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const match = trimmed.match(/^GEMINI_API_KEY\s*=\s*(.*)$/)
          if (match) {
            let val = match[1].trim()
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1)
            }
            if (val) {
              process.env.GEMINI_API_KEY = val
              return val
            }
          }
        }
      }
    } catch {
      // Ignore file access errors gracefully
    }
  }

  return null
}

export function checkRateLimit(ip) {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip) || []
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return true
  }

  recent.push(now)
  rateLimitMap.set(ip, recent)

  // Prune map if it grows large
  if (rateLimitMap.size > 500) {
    for (const [key, times] of rateLimitMap.entries()) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitMap.delete(key)
      }
    }
  }

  return false
}

// Reset rate limit map (useful for test isolation)
export function _resetRateLimits() {
  rateLimitMap.clear()
}

export default async function handler(req, res) {
  // 1. Enforce POST method only
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
  }

  // 2. Client IP extraction for best-effort warm container throttling
  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  if (checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before requesting another suggestion.',
    })
  }

  // 3. Server-side API key check (never sent to client or logged)
  const apiKey = resolveGeminiApiKey()
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI suggestion service is not configured on the server.',
    })
  }

  // 4. Input validation & size constraints
  const body = req.body || {}
  const { title, description } = body

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return res.status(400).json({
      error: 'Idea title must be a valid text string of at least 3 characters.',
    })
  }

  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    return res.status(400).json({
      error: 'Idea description must be a valid text string of at least 10 characters.',
    })
  }

  if (title.length > 100 || description.length > 2000) {
    return res.status(400).json({
      error: 'Idea title or description exceeds permitted length limit.',
    })
  }

  // 5. Query Google Gemini API
  // gemini-3.5-flash-lite is the active, high-speed, structured-output model in Google AI Studio
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  const systemInstruction = `You are an automated campus proposal classifier for CampusVoice, a student idea portal.
Your job is to analyze any student proposal—ranging from everyday campus improvements to unusual, interdisciplinary, technical, or creative projects—and classify it into EXACTLY ONE of the 7 valid campus categories below:

Valid Categories & Core Intent:
1. "Academics": Research projects, coursework, scientific/engineering development, lab resources, academic funding, student competitions, hardware/software development for study or research, library materials, faculty advising.
2. "Campus Life": Student clubs, extracurricular societies, events, campus community, traditions, student governance, arts/culture, recreational gatherings.
3. "Dining": Food options, cafeteria improvements, nutrition, dietary accommodations, dining halls, campus cafes.
4. "Facilities": Physical campus infrastructure, buildings, classrooms, Wi-Fi/internet networks, labs physical space, lighting, utilities, campus physical maintenance.
5. "Sustainability": Renewable energy, waste reduction, recycling, composting, conservation, environmental footprint.
6. "Transportation": Shuttles, buses, parking, bicycle infrastructure, campus mobility, transit passes.
7. "Wellness": Mental health, fitness, counseling, campus recreation gyms, medical services, student well-being.

Classification Principles:
- Classify based on primary student intent and institutional impact:
  * If a proposal involves technical research, scientific engineering, satellite or robotics development, or academic hardware/funding: classify as "Academics" (or "Campus Life" if framed specifically as a social student club activity).
  * If a proposal involves physical utilities, internet connectivity, or campus building improvements: classify as "Facilities".
  * For unusual, unconventional, or cross-disciplinary ideas, identify the underlying core objective and map it to the single most relevant category among the 7 valid choices.
- NEVER invent new categories or return categories outside the 7 listed above.
- Return ONLY valid JSON adhering to the specified schema:
  {"category": string, "confidence": number, "reasoning": string}
- "category": MUST be one of the 7 valid category names verbatim.
- "confidence": Float between 0.0 and 1.0.
- "reasoning": Concise, one-sentence explanation of why this category fits the proposal's primary intent (max 20 words).`

  const prompt = `Proposal Title: "${title.trim()}"\nProposal Description: "${description.trim()}"`

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          category: {
            type: 'STRING',
            enum: VALID_CATEGORIES,
          },
          confidence: { type: 'NUMBER' },
          reasoning: { type: 'STRING' },
        },
        required: ['category', 'confidence', 'reasoning'],
      },
    },
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    let upstreamResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    // If primary model returns 503 (high demand), 500, or 404, gracefully fall back to alternative verified model
    if (
      !upstreamResponse.ok &&
      (upstreamResponse.status === 503 || upstreamResponse.status === 500 || upstreamResponse.status === 404) &&
      !process.env.GEMINI_MODEL
    ) {
      const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash'
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${encodeURIComponent(apiKey)}`
      try {
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })
        if (fallbackRes.ok) {
          upstreamResponse = fallbackRes
        } else {
          const errText =
            typeof fallbackRes.text === 'function'
              ? await fallbackRes.text().catch(() => '')
              : ''
          console.error(`[AI Provider Fallback Warning] Model ${fallbackModel} responded with status ${fallbackRes.status}: ${errText.slice(0, 150)}`)
        }
      } catch (fallbackErr) {
        if (fallbackErr.name === 'AbortError') throw fallbackErr
        console.error(`[AI Provider Fallback Exception] ${fallbackErr.message}`)
      }
    }

    clearTimeout(timeoutId)

    if (!upstreamResponse.ok) {
      const errSnippet =
        typeof upstreamResponse.text === 'function'
          ? await upstreamResponse.text().catch(() => '')
          : ''
      console.error(`[AI Provider Error] Status: ${upstreamResponse.status}, Details: ${errSnippet.slice(0, 150)}`)

      if (upstreamResponse.status === 429) {
        return res.status(429).json({
          error: 'AI service quota reached. Please select a category manually.',
        })
      }
      return res.status(502).json({
        error: 'Upstream AI provider error. Please select a category manually.',
      })
    }

    const data = await upstreamResponse.json()
    const candidate = data?.candidates?.[0]

    if (candidate?.finishReason === 'SAFETY') {
      return res.status(422).json({
        error: 'The proposal content could not be classified due to content safety policies. Please select a category manually.',
      })
    }

    const rawText = candidate?.content?.parts?.[0]?.text

    if (!rawText) {
      return res.status(502).json({
        error: 'Unable to derive category from proposal content.',
      })
    }

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return res.status(502).json({
        error: 'Invalid AI response formatting. Please select a category manually.',
      })
    }

    const suggestedCategory = typeof parsed.category === 'string' ? parsed.category.trim() : ''

    // 6. Strict Server-Side Category Whitelist Validation
    if (!suggestedCategory || !VALID_CATEGORIES.includes(suggestedCategory)) {
      return res.status(422).json({
        error: 'AI suggestion did not match an allowed campus category.',
      })
    }

    return res.status(200).json({
      category: suggestedCategory,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.min(Math.max(parsed.confidence, 0), 1)
          : 0.8,
      reasoning:
        typeof parsed.reasoning === 'string'
          ? parsed.reasoning.trim().slice(0, 150)
          : '',
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'AI request timed out. Please select a category manually.',
      })
    }
    // Never expose stack trace, internal secrets, or raw error message
    return res.status(500).json({
      error: 'An internal error occurred while generating the category suggestion.',
    })
  }
}
