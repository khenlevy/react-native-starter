/**
 * Returns a timestamp representing the current time plus a given number of seconds
 * @param {number} secondsFromNow - Number of seconds from now
 * @returns {number} Future timestamp
 */
export function getFutureTimestampFromSeconds(secondsFromNow) {
  return Date.now() + secondsFromNow * 1000;
}
