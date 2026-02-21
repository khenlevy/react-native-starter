/**
 * Dev Mode Filtering Utilities
 *
 * Handles DEV_MODE_LIMIT and DEV_MODE_COMPANY environment variables
 * to filter and prioritize companies during development.
 */

/**
 * Parses DEV_MODE_COMPANY environment variable
 * @returns {string[]|null} Array of company symbols (e.g., ['CSIS.JK', '8CF.BE']) or null
 */
export function parseDevModeCompany() {
  const devModeCompany = process.env.DEV_MODE_COMPANY;
  if (!devModeCompany) return null;

  return devModeCompany
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Gets DEV_MODE_LIMIT from environment
 * @returns {number|null} Limit number or null
 */
export function getDevModeLimit() {
  return process.env.DEV_MODE_LIMIT ? parseInt(process.env.DEV_MODE_LIMIT, 10) : null;
}

/**
 * Builds symbol key from symbol object and exchange code
 * @param {Object} symbol - Symbol object with Code property
 * @param {string} exchangeCode - Exchange code
 * @returns {string} Symbol key (e.g., 'CSIS.JK' or 'AAPL.US')
 */
export function buildSymbolKey(symbol, exchangeCode) {
  // Handle US exchanges specially
  if (exchangeCode === "US") {
    return `${symbol.Code}.US`;
  }
  return `${symbol.Code}.${exchangeCode}`;
}

/**
 * Reorganizes stocks across all exchanges to prioritize DEV_MODE_COMPANY companies
 *
 * @param {Array} largeCapExchanges - Array of exchange objects with symbols
 * @param {Function} log - Logging function
 * @returns {Array} Reorganized array of {stock, exchangeCode} objects
 */
export function prioritizeStocksAcrossExchanges(largeCapExchanges, log = () => {}) {
  const devModeLimit = getDevModeLimit();
  const devModeCompanies = parseDevModeCompany();

  // Always log using the provided log function (which uses se-logger)
  log(
    `🔧 DEV MODE: Checking DEV_MODE_COMPANY=${
      process.env.DEV_MODE_COMPANY || "not set"
    }, DEV_MODE_LIMIT=${process.env.DEV_MODE_LIMIT || "not set"}`
  );

  // If no DEV_MODE_COMPANY, return null to use normal processing
  if (!devModeCompanies || devModeCompanies.length === 0 || !devModeLimit) {
    log(
      `🔧 DEV MODE: Skipping prioritization - companies: ${devModeCompanies?.length || 0}, limit: ${
        devModeLimit || "none"
      }`
    );
    return null;
  }

  log(`🔧 DEV MODE: Looking for companies: ${devModeCompanies.join(", ")}`);

  const prioritized = [];
  const remaining = [];

  // Collect all stocks and separate prioritized ones
  for (const exchangeDoc of largeCapExchanges) {
    for (const stock of exchangeDoc.symbols) {
      const symbolKey = buildSymbolKey(stock, exchangeDoc.exchangeCode);
      if (devModeCompanies.includes(symbolKey)) {
        prioritized.push({ stock, exchangeCode: exchangeDoc.exchangeCode });
      } else {
        remaining.push({ stock, exchangeCode: exchangeDoc.exchangeCode });
      }
    }
  }

  // Combine prioritized first, then remaining, up to limit
  const result = [...prioritized, ...remaining].slice(0, devModeLimit);

  log(
    `🔧 DEV MODE: Found ${prioritized.length} prioritized companies out of ${devModeCompanies.length} requested`
  );
  if (prioritized.length > 0) {
    const prioritizedSymbols = prioritized
      .map(({ stock, exchangeCode }) => buildSymbolKey(stock, exchangeCode))
      .join(", ");
    log(`🔧 DEV MODE: Prioritizing companies: ${prioritizedSymbols}`);
  } else {
    log(`🔧 DEV MODE: WARNING - None of the requested companies were found in the database!`);
    if (largeCapExchanges.length > 0 && largeCapExchanges[0].symbols?.length > 0) {
      const sampleSymbols = largeCapExchanges[0].symbols
        .slice(0, 5)
        .map((s) => buildSymbolKey(s, largeCapExchanges[0].exchangeCode))
        .join(", ");
      log(
        `🔧 DEV MODE: Available companies in first exchange (${largeCapExchanges[0].exchangeCode}): ${sampleSymbols}`
      );
    }
  }

  log(`🔧 DEV MODE: Processing ${result.length} companies total (limit: ${devModeLimit})`);

  return result;
}
