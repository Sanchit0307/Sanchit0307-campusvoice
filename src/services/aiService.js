/**
 * AI Service for CampusVoice
 * Communicates with the server-side /api/suggest-category endpoint.
 * Keeps all API keys isolated server-side.
 */

/**
 * Request an AI-assisted category suggestion for a proposed idea.
 *
 * @param {object} params
 * @param {string} params.title - Proposal title (minimum 3 characters)
 * @param {string} params.description - Proposal description (minimum 10 characters)
 * @param {AbortSignal} [params.signal] - Optional AbortSignal for request cancellation
 * @returns {Promise<{ category: string, confidence: number, reasoning: string }>}
 */
export async function suggestCategory({ title, description, signal }) {
  const trimmedTitle = typeof title === 'string' ? title.trim() : ''
  const trimmedDesc = typeof description === 'string' ? description.trim() : ''

  if (trimmedTitle.length < 3) {
    throw new Error('Please enter a title of at least 3 characters before requesting a suggestion.')
  }

  if (trimmedDesc.length < 10) {
    throw new Error('Please enter a description of at least 10 characters before requesting a suggestion.')
  }

  let response
  try {
    response = await fetch('/api/suggest-category', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: trimmedTitle,
        description: trimmedDesc,
      }),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err
    }
    throw new Error('Unable to connect to the suggestion service. Please check your network or select a category manually.')
  }

  const contentType = response.headers.get('content-type') || ''
  let data

  if (contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch {
      throw new Error('Received an unreadable JSON response from the server. Please select a category manually.')
    }
  } else {
    // Non-JSON response (e.g. Vite SPA HTML fallback or web server error page)
    const text = await response.text().catch(() => '')
    const lowerText = text.toLowerCase()
    if (lowerText.includes('<!doctype') || lowerText.includes('<html')) {
      throw new Error('The suggestion endpoint returned an HTML page instead of JSON. Ensure your API server is running at http://127.0.0.1:3000.')
    }
    const cleanText = text.replace(/<[^>]*>/g, '').trim().slice(0, 100)
    throw new Error(cleanText || 'Received an unreadable response from the server. Please select a category manually.')
  }

  if (!response.ok) {
    const errorMsg = data?.error || 'Unable to suggest a category at this time. Please select a category manually.'
    throw new Error(errorMsg)
  }

  if (!data || typeof data.category !== 'string' || !data.category) {
    throw new Error('No category recommendation was received. Please select a category manually.')
  }

  return {
    category: data.category,
    confidence: typeof data.confidence === 'number' ? data.confidence : 1.0,
    reasoning: typeof data.reasoning === 'string' ? data.reasoning : '',
  }
}
