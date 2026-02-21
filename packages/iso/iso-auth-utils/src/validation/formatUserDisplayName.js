/**
 * Format a user display name from various user data structures
 * @param {Object} userInfo - User information object
 * @param {string} fallbackProvider - Provider name to use as fallback (e.g., "google", "apple")
 * @returns {string} Formatted display name
 */
export function formatUserDisplayName(userInfo, fallbackProvider = "user") {
  if (userInfo.name) {
    if (typeof userInfo.name === "string") {
      return userInfo.name;
    }
    if (userInfo.name.firstName && userInfo.name.lastName) {
      return `${userInfo.name.firstName} ${userInfo.name.lastName}`;
    }
    if (userInfo.name.firstName) {
      return userInfo.name.firstName;
    }
  }

  // Fallback to provider name with capitalized first letter
  const providerName = fallbackProvider.charAt(0).toUpperCase() + fallbackProvider.slice(1);
  return `${providerName} User`;
}
