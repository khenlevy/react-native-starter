/**
 * Group dividend history by year, summing up all dividends for each year
 * @param {Array} history - Array of dividend history objects with date and value
 * @returns {Object} Object with years as keys and total dividend amounts as values
 */
export function groupByYear(history) {
  const perYear = {};
  history.forEach((d) => {
    const year = new Date(d.date).getFullYear();
    perYear[year] = (perYear[year] || 0) + d.value;
  });
  return perYear;
}
