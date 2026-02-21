/**
 * Check if a given timestamp is in the past (expired)
 * @param {number} expiryTimestamp - Timestamp to check
 * @returns {boolean} Whether timestamp is expired
 */
export function isTimestampExpired(expiryTimestamp) {
  return Date.now() >= expiryTimestamp;
}
