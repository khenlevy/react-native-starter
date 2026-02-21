/**
 * Clean dividend history data by removing specials, outliers, and invalid entries
 *
 * This function processes raw dividend history data to:
 * - Remove special dividends
 * - Filter out invalid dates and values
 * - Deduplicate entries by date
 * - Ensure numeric values are valid
 * - Sort by date
 *
 * @param {Array} history - Raw dividend history array from API
 * @returns {Array} Cleaned dividend history array
 */
export function cleanDividendHistory(history) {
  const seen = new Set();
  const out = [];

  for (const d of history) {
    const date = new Date(d?.date || d?.Date || 0);
    if (isNaN(+date)) continue;

    const key = date.toISOString().slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);

    const period = String(d?.period || d?.Period || "").toLowerCase();
    if (period.includes("special")) continue;

    const val = Number(d?.value ?? d?.Value ?? 0);
    if (!Number.isFinite(val) || val <= 0) continue;

    out.push({ date: key, value: val, period });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}
