/**
 * Common utility functions
 */

/**
 * Generate a URL-friendly slug from a given string
 * @param {string} text - The text to convert to a slug
 * @returns {string} - The generated slug
 */
const generateSlug = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .toLowerCase()                    // Convert to lowercase
    .trim()                          // Remove leading/trailing spaces
    .replace(/[^\w\s-]/g, '')        // Remove all non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, '_')        // Replace spaces, underscores and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');        // Remove leading/trailing hyphens
};

/**
 * Generate a unique slug by appending a number if slug already exists
 * @param {string} text - The text to convert to a slug
 * @param {Function} checkExistence - Async function that checks if slug exists
 * @returns {Promise<string>} - The generated unique slug
 */
const generateUniqueSlug = async (text, checkExistence) => {
  let baseSlug = generateSlug(text);
  let slug = baseSlug;
  let counter = 1;

  // Keep checking and incrementing until we find a unique slug
  while (await checkExistence(slug)) {
    slug = `${baseSlug}_${counter}`;
    counter++;
  }

  return slug;
};

module.exports = {
  generateSlug,
  generateUniqueSlug
};
