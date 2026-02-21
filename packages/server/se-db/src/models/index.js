/**
 * Mongoose Models for Buydy Database
 *
 * This file exports all Mongoose models with proper schema validation
 * and business logic for better understanding of database documents.
 */

// Import all models
import { Exchange } from "./Exchange.js";
import { ExchangeSymbols } from "./ExchangeSymbols.js";
import { Fundamentals } from "./Fundamentals.js";
import { Jobs } from "./Jobs.js";
import { Dividends } from "./Dividends.js";
import { Technicals } from "./Technicals.js";
import { Metrics } from "./Metrics.js";
import { symbolSchema } from "./Symbol.js";
import { CachedResponseEodhd } from "./CachedResponseEodhd.js";
import { CycledListStatus } from "./CycledListStatus.js";

// Export all models
export {
  Exchange,
  ExchangeSymbols,
  Fundamentals,
  Jobs,
  Dividends,
  Technicals,
  Metrics,
  symbolSchema,
  CachedResponseEodhd,
  CycledListStatus,
};

// Export as default object for convenience
export default {
  Exchange,
  ExchangeSymbols,
  Fundamentals,
  Jobs,
  Dividends,
  Technicals,
  Metrics,
  symbolSchema,
  CachedResponseEodhd,
  CycledListStatus,
};

/**
 * Model Registry
 *
 * This object provides easy access to all models and their schemas
 * for better understanding of database structure.
 */
export const ModelRegistry = {
  // Collections
  collections: {
    exchanges: {
      model: Exchange,
      description: "Exchange information from EODHD API",
      fields: [
        "code",
        "Code",
        "Country",
        "CountryISO2",
        "CountryISO3",
        "Currency",
        "Name",
        "OperatingMIC",
        "fetchedAt",
        "updatedAt",
      ],
    },
    exchange_symbols: {
      model: ExchangeSymbols,
      description: "All symbols for each exchange from EODHD API",
      fields: ["exchangeCode", "symbols", "fetchedAt", "updatedAt"],
      embedded: {
        symbols: {
          schema: symbolSchema,
          description: "Individual symbol information",
          fields: ["Code", "Name", "Country", "Exchange", "Currency", "Type", "Isin"],
        },
      },
    },
    fundamentals: {
      model: Fundamentals,
      description: "Fundamental data for symbols from EODHD API",
      fields: ["symbol", "market", "fundamentals", "fetchedAt", "updatedAt"],
    },
    jobs: {
      model: Jobs,
      description: "Job execution tracking and logging",
      fields: [
        "name",
        "status",
        "scheduledAt",
        "startedAt",
        "endedAt",
        "progress",
        "result",
        "error",
        "errorDetails",
        "logs",
        "metadata",
      ],
    },
    dividends: {
      model: Dividends,
      description: "Dividend data for symbols from EODHD API",
      fields: [
        "symbol",
        "exchange",
        "currency",
        "dividendYield",
        "history",
        "upcoming",
        "lastUpdated",
        "fetchedAt",
      ],
    },
    technicals: {
      model: Technicals,
      description: "Technical indicator data for symbols from EODHD API",
      fields: ["symbol", "exchange", "currency", "indicators", "lastUpdated", "fetchedAt"],
    },
    metrics: {
      model: Metrics,
      description: "Calculated financial metrics for symbols",
      fields: ["symbol", "exchange", "currency", "metrics", "lastUpdated", "fetchedAt"],
    },
    cached_response_eodhistoricaldata: {
      model: CachedResponseEodhd,
      description: "Cached EODHD API responses for usage tracking and analytics",
      fields: ["cacheKey", "apiEndpoint", "params", "data", "expiresAt", "createdAt", "updatedAt"],
    },
  },

  // Relationships
  relationships: {
    "Exchange -> ExchangeSymbols": {
      type: "one-to-one",
      localField: "code",
      foreignField: "exchangeCode",
      description: "Each exchange has one symbols document",
    },
    "ExchangeSymbols -> Symbol": {
      type: "one-to-many",
      localField: "symbols",
      foreignField: "embedded",
      description: "Each exchange symbols document contains many symbol objects",
    },
    "Fundamentals -> Symbol": {
      type: "one-to-one",
      localField: "symbol",
      foreignField: "Code",
      description: "Each fundamentals document corresponds to one symbol",
    },
    "Dividends -> Symbol": {
      type: "one-to-one",
      localField: "symbol",
      foreignField: "Code",
      description: "Each dividends document corresponds to one symbol",
    },
    "Technicals -> Symbol": {
      type: "one-to-one",
      localField: "symbol",
      foreignField: "Code",
      description: "Each technicals document corresponds to one symbol",
    },
    "Metrics -> Symbol": {
      type: "one-to-one",
      localField: "symbol",
      foreignField: "Code",
      description: "Each metrics document corresponds to one symbol",
    },
  },

  // Business Rules
  businessRules: {
    exchanges: {
      required: ["code", "Code", "Country", "Currency", "Name"],
      unique: ["code"],
      indexes: ["code", "Country", "Currency", "fetchedAt"],
    },
    exchange_symbols: {
      required: ["exchangeCode", "symbols"],
      unique: ["exchangeCode"],
      indexes: ["exchangeCode", "fetchedAt", "symbols.Code", "symbols.Type"],
    },
    fundamentals: {
      required: ["symbol", "market", "fundamentals"],
      unique: ["symbol"],
      indexes: ["symbol", "market", "fetchedAt"],
    },
    jobs: {
      required: ["name", "status", "scheduledAt"],
      unique: [],
      indexes: ["name", "status", "scheduledAt", "name+scheduledAt", "status+scheduledAt"],
    },
    dividends: {
      required: ["symbol", "exchange", "currency", "lastUpdated", "fetchedAt"],
      unique: ["symbol"],
      indexes: ["symbol", "exchange", "lastUpdated", "exchange+lastUpdated", "symbol+lastUpdated"],
    },
    technicals: {
      required: ["symbol", "exchange", "currency", "indicators", "lastUpdated", "fetchedAt"],
      unique: ["symbol"],
      indexes: ["symbol", "exchange", "lastUpdated", "exchange+lastUpdated", "symbol+lastUpdated"],
    },
    metrics: {
      required: ["symbol", "exchange", "currency", "metrics", "lastUpdated", "fetchedAt"],
      unique: ["symbol"],
      indexes: ["symbol", "exchange", "lastUpdated", "exchange+lastUpdated", "symbol+lastUpdated"],
    },
  },

  // Data Flow
  dataFlow: {
    syncExchangesAndSymbols: {
      creates: ["exchanges", "exchange_symbols"],
      updates: ["exchanges", "exchange_symbols"],
      description: "Syncs exchange and symbol data from EODHD API",
    },
    syncFundamentalsWhitelist: {
      creates: ["fundamentals"],
      updates: ["fundamentals"],
      reads: ["exchanges", "exchange_symbols"],
      description: "Syncs fundamental data for whitelisted symbols",
    },
  },
};

/**
 * Helper function to get model by collection name
 * @param {string} collectionName - Collection name
 * @returns {Object} Model and metadata
 */
export function getModelByCollection(collectionName) {
  const collection = ModelRegistry.collections[collectionName];
  if (!collection) {
    throw new Error(`Collection '${collectionName}' not found in model registry`);
  }
  return collection;
}

/**
 * Helper function to get all collection names
 * @returns {Array} Array of collection names
 */
export function getAllCollectionNames() {
  return Object.keys(ModelRegistry.collections);
}

/**
 * Helper function to get model relationships
 * @param {string} collectionName - Collection name
 * @returns {Array} Array of relationships
 */
export function getModelRelationships(collectionName) {
  const relationships = [];
  for (const [key, relationship] of Object.entries(ModelRegistry.relationships)) {
    if (key.includes(collectionName)) {
      relationships.push(relationship);
    }
  }
  return relationships;
}
