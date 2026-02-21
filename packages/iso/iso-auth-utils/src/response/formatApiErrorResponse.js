/**
 * Format a standardized error object for API responses, including message, code, status, and timestamp
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Standardized error object
 */
export function formatApiErrorResponse(message, code = "AUTH_ERROR", statusCode = 400) {
  return {
    error: true,
    message,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
  };
}
