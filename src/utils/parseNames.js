import { supabase } from '../lib/supabase'

// Common field names for person names
const NAME_FIELDS = ['name', 'full_name', 'fullName', 'display_name', 'displayName', 'real_name', 'realName']

// Common field names for photo URLs
const PHOTO_FIELDS = ['image_url', 'imageUrl', 'photo_url', 'photoUrl', 'photo', 'image', 'avatar', 'picture', 'profile_image', 'profileImage', 'smallPhoto', 'small_photo', 'thumbnail', 'headshot', 'profile_photo', 'profilePhoto']

/**
 * Extract a name from an object by checking common field names
 */
function extractName(obj) {
  for (const field of NAME_FIELDS) {
    if (obj[field] && typeof obj[field] === 'string') {
      return obj[field].trim()
    }
  }
  return null
}

/**
 * Extract a photo URL from an object by checking common field names
 */
function extractPhotoUrl(obj) {
  for (const field of PHOTO_FIELDS) {
    if (obj[field] && typeof obj[field] === 'string' && obj[field].startsWith('http')) {
      return obj[field]
    }
  }
  return null
}

/**
 * Recursively search for name and photo in an object
 */
function extractFromNested(obj, depth = 0) {
  if (depth > 5 || !obj || typeof obj !== 'object') return null

  // First try direct extraction
  const name = extractName(obj)
  if (name) {
    const photoUrl = extractPhotoUrl(obj) || extractPhotoFromNested(obj)
    return { name, photoUrl }
  }

  // Then search nested objects
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const result = extractFromNested(value, depth + 1)
      if (result) return result
    }
  }
  return null
}

/**
 * Search nested objects for photo URL
 */
function extractPhotoFromNested(obj, depth = 0) {
  if (depth > 3 || !obj || typeof obj !== 'object') return null

  const photo = extractPhotoUrl(obj)
  if (photo) return photo

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const result = extractPhotoFromNested(value, depth + 1)
      if (result) return result
    }
  }
  return null
}

/**
 * Try to parse names using common JSON field names
 */
function parseWithCommonKeys(parsed) {
  const names = []
  const imageUrls = {}

  // Handle object with 'data' array (common API response format)
  let items = parsed
  if (!Array.isArray(parsed) && parsed.data && Array.isArray(parsed.data)) {
    items = parsed.data
  }

  if (!Array.isArray(items)) {
    // Single object - try to extract name (with nesting)
    const result = extractFromNested(items)
    if (result?.name) {
      names.push(result.name)
      if (result.photoUrl) imageUrls[result.name] = result.photoUrl
    }
    return { names, imageUrls }
  }

  for (const item of items) {
    if (typeof item === 'string') {
      // Array of strings
      const trimmed = item.trim()
      if (trimmed) names.push(trimmed)
    } else if (typeof item === 'object' && item !== null) {
      // Array of objects - try nested extraction
      const result = extractFromNested(item)
      if (result?.name) {
        names.push(result.name)
        if (result.photoUrl) imageUrls[result.name] = result.photoUrl
      }
    }
  }

  return { names: [...new Set(names)], imageUrls }
}

/**
 * Parse plain text (newlines or commas) into names
 */
function parsePlainText(text) {
  const lines = text.split(/[\n,]+/)
  const names = lines
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.length < 100)

  return { names: [...new Set(names)], imageUrls: {} }
}

/**
 * Call the extract-names edge function for LLM-based extraction
 */
async function extractWithLLM(text) {
  const { data, error } = await supabase.functions.invoke('extract-names', {
    body: { text }
  })

  if (error) {
    console.error('LLM extraction failed:', error)
    return { names: [], imageUrls: {} }
  }

  const names = []
  const imageUrls = {}

  for (const item of data.names || []) {
    if (item.name) {
      names.push(item.name)
      if (item.photoUrl) {
        imageUrls[item.name] = item.photoUrl
      }
    }
  }

  return { names: [...new Set(names)], imageUrls }
}

/**
 * Parse input text to extract names and optional photo URLs.
 * Uses layered approach: plain text → common JSON keys → LLM fallback
 *
 * @param {string} input - Raw text input (plain text or JSON)
 * @returns {Promise<{names: string[], imageUrls: Record<string, string>, usedLLM: boolean}>}
 */
export async function parseNames(input) {
  const text = input.trim()
  console.log('[parseNames] Input:', text.substring(0, 100))
  if (!text) return { names: [], imageUrls: {}, usedLLM: false }

  // Check if it looks like JSON
  const looksLikeJson = text.startsWith('[') || text.startsWith('{')
  console.log('[parseNames] looksLikeJson:', looksLikeJson)

  if (!looksLikeJson) {
    // Plain text parsing
    const result = parsePlainText(text)
    console.log('[parseNames] Plain text result:', result)
    return { ...result, usedLLM: false }
  }

  // Try JSON parsing
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    // Invalid JSON - treat as plain text
    const result = parsePlainText(text)
    return { ...result, usedLLM: false }
  }

  // Try common field names first
  const commonResult = parseWithCommonKeys(parsed)
  console.log('[parseNames] Common keys result:', commonResult)
  if (commonResult.names.length > 0) {
    return { ...commonResult, usedLLM: false }
  }

  // Fallback to LLM extraction
  console.log('[parseNames] Falling back to LLM...')
  const llmResult = await extractWithLLM(text)
  console.log('[parseNames] LLM result:', llmResult)
  return { ...llmResult, usedLLM: true }
}

/**
 * Synchronous preview parser (no LLM, for live preview)
 * Returns names found with common keys only
 */
export function parseNamesSync(input) {
  const text = input.trim()
  if (!text) return { names: [], imageUrls: [], needsLLM: false }

  const looksLikeJson = text.startsWith('[') || text.startsWith('{')

  if (!looksLikeJson) {
    return { ...parsePlainText(text), needsLLM: false }
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ...parsePlainText(text), needsLLM: false }
  }

  const result = parseWithCommonKeys(parsed)
  // If JSON parsed but no names found, indicate LLM is needed
  const needsLLM = result.names.length === 0
  return { ...result, needsLLM }
}
