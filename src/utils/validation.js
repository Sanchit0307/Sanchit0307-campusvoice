export const TITLE_MIN_LENGTH = 5
export const TITLE_MAX_LENGTH = 100
export const DESC_MIN_LENGTH = 20
export const DESC_MAX_LENGTH = 500

/**
 * Validates the idea submission form fields.
 *
 * @param {object} formData
 * @param {string} [formData.title]
 * @param {string} [formData.category]
 * @param {string} [formData.description]
 * @param {Array<string>|null} [validCategories] Optional list of allowed categories
 * @returns {object} Object with field names as keys and validation error messages as values
 */
export function validateIdeaSubmission(formData = {}, validCategories = null) {
  const nextErrors = {}
  const title = typeof formData?.title === 'string' ? formData.title : ''
  const description = typeof formData?.description === 'string' ? formData.description : ''
  const category = formData?.category || ''

  const trimmedTitle = title.trim()
  const trimmedDesc = description.trim()

  if (!trimmedTitle) {
    nextErrors.title = 'Please enter an idea title.'
  } else if (trimmedTitle.length < TITLE_MIN_LENGTH) {
    nextErrors.title = `Title must be at least ${TITLE_MIN_LENGTH} characters.`
  } else if (trimmedTitle.length > TITLE_MAX_LENGTH) {
    nextErrors.title = `Title cannot exceed ${TITLE_MAX_LENGTH} characters.`
  }

  if (!category) {
    nextErrors.category = 'Please select a category for your idea.'
  } else if (Array.isArray(validCategories) && !validCategories.includes(category)) {
    nextErrors.category = 'Please select a valid category from the available options.'
  }

  if (!trimmedDesc) {
    nextErrors.description = 'Please provide a description of your proposal.'
  } else if (trimmedDesc.length < DESC_MIN_LENGTH) {
    nextErrors.description = `Description must be at least ${DESC_MIN_LENGTH} characters to explain your proposal.`
  } else if (trimmedDesc.length > DESC_MAX_LENGTH) {
    nextErrors.description = `Description cannot exceed ${DESC_MAX_LENGTH} characters.`
  }

  return nextErrors
}

/**
 * Returns character counter CSS modifier based on field length thresholds.
 *
 * @param {number} currentLength
 * @param {number} maxLength
 * @returns {string}
 */
export function getCounterClass(currentLength, maxLength) {
  if (currentLength >= maxLength) return 'counter-max'
  if (currentLength >= maxLength * 0.85) return 'counter-warning'
  return ''
}
