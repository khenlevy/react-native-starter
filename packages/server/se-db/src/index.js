import {
  Exchange,
  ExchangeSymbols,
  Fundamentals,
  Dividends,
  Jobs,
  Technicals,
  Metrics,
  CachedResponseEodhd,
  CycledListStatus,
} from "./models/index.js";

export { getDatabase, closeDatabase, ensureConnected } from "./db.js";
export { waitForMongo } from "./init.js";
export { MongoDbClient } from "./client.js";

export * from "./models/index.js";

// Index management exports
export {
  indexRules,
  getIndexRules,
  getCollectionNames,
  ensureIndexes,
  getIndexStatus,
  printIndexStatus,
} from "./indexes/index.js";

// Helper function to get Mongoose models
// Simply returns the model - connection is ensured at app startup
export function getModel(collectionName) {
  const models = {
    exchanges: Exchange,
    exchange_symbols: ExchangeSymbols,
    fundamentals: Fundamentals,
    dividends: Dividends,
    jobs: Jobs,
    technicals: Technicals,
    metrics: Metrics,
    cached_response_eodhistoricaldata: CachedResponseEodhd,
    cycled_list_status: CycledListStatus,
  };

  const model = models[collectionName];
  if (!model) {
    throw new Error(`Model for collection '${collectionName}' not found`);
  }

  // Since connection is established at startup (in index.js main()),
  // we can directly return the model without wrapping
  return model;
}
