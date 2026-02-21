/**
 * Generate a secure random alphanumeric string of specified length
 * @param {number} length - String length (default: 32)
 * @returns {string} Random alphanumeric string
 */
export function generateRandomAlphanumericString(length = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
