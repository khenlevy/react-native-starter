// mapper.js
import { SYMBOL_WHITELIST } from "./whitelist.js";

/**
 * Ensures a symbol is valid for EODHD by mapping
 * input ticker -> correct "<SYMBOL>.<EXCHANGE>"
 *
 * @param {string} rawSymbol - user/raw ticker like "PME.CXA" or "AAPL"
 * @returns {string|null} valid EODHD ticker or null if not found
 */
export function mapSymbol(rawSymbol) {
  if (!rawSymbol) return null;

  const normalized = rawSymbol.trim().toUpperCase();

  // Already in whitelist?
  if (SYMBOL_WHITELIST[normalized]) {
    return normalized;
  }

  // Handle fallback: maybe user passes "AAPL" -> we find "AAPL.US"
  const key = Object.keys(SYMBOL_WHITELIST).find((s) => s.startsWith(normalized + "."));

  return key || null;
}
