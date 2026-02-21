/**
 * Remove sensitive properties (password, tokens) from user data for safe output
 * @param {Object} userData - Raw user data
 * @returns {Object} Sanitized user data without sensitive fields
 */
export function removeSensitiveUserFields(userData) {
  const sanitized = { ...userData };

  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.accessToken;
  delete sanitized.refreshToken;
  delete sanitized.idToken;

  return sanitized;
}
