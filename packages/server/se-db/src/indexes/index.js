/**
 * Index Management Module
 *
 * Exports all index management functions for use throughout the application.
 */

export { indexRules, getIndexRules, getCollectionNames } from "./indexRules.js";
export { ensureIndexes } from "./indexManager.js";
export { getIndexStatus, printIndexStatus } from "./indexStatus.js";
