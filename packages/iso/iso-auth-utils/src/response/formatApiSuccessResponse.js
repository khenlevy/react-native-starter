/**
 * Format a standardized success object for API responses, including data, message, and timestamp
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Standardized success object
 */
export function formatApiSuccessResponse(data, message = "Authentication successful") {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}
