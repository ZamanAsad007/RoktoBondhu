/**
 * Domain Logic: Masked Chat Privacy Filter & Profanity Sanitizer (Phase 19)
 */

// Bangladeshi mobile phone regex (handles spaced, dashed, and standard formats)
const BD_PHONE_REGEX =
  /(?:\+?88\s*0?1[3-9]|\b01[3-9])[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d\b/gi;

// Basic spam / profanity filter list
const PROFANITY_LIST = ['scam', 'fraud', 'cheat', 'boka', 'foul', 'fake'];

/**
 * Pure function: Masks phone numbers in text until unlocked
 *
 * @param {string} text - User message content
 * @returns {string} Sanitized content with phone numbers replaced
 */
function maskPhoneNumbers(text = '') {
  if (typeof text !== 'string') return '';
  return text.replace(BD_PHONE_REGEX, '[PHONE NUMBER HIDDEN - USE CHAT UNLOCK]');
}

/**
 * Pure function: Filter profanity or aggressive words
 *
 * @param {string} text
 * @returns {string} Sanitized content
 */
function filterProfanity(text = '') {
  if (typeof text !== 'string') return '';
  let sanitized = text;
  for (const word of PROFANITY_LIST) {
    const reg = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(reg, '***');
  }
  return sanitized;
}

/**
 * Combined message sanitizer
 */
function sanitizeChatMessage(text = '', isPhoneUnlocked = false) {
  let cleaned = filterProfanity(text);
  if (!isPhoneUnlocked) {
    cleaned = maskPhoneNumbers(cleaned);
  }
  return cleaned;
}

module.exports = {
  BD_PHONE_REGEX,
  maskPhoneNumbers,
  filterProfanity,
  sanitizeChatMessage,
};
