/**
 * Index Status Reporter
 *
 * Provides visibility into index status - which indexes exist and which are missing.
 */

import logger from "@buydy/se-logger";
import { indexRules } from "./indexRules.js";

/**
 * Normalize index key for comparison
 * @param {Object} key - Index key object
 * @returns {string} Normalized key string
 */
function normalizeIndexKey(key) {
  const sortedEntries = Object.entries(key).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(sortedEntries));
}

/**
 * Get index status for all collections
 *
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<Object>} Status report for each collection
 */
export async function getIndexStatus(db) {
  const status = {};

  for (const [collectionName, rules] of Object.entries(indexRules)) {
    try {
      const collection = db.collection(collectionName);

      // Check if collection exists
      const collectionExists = await collection.countDocuments({}, { limit: 1 }).catch(() => false);

      if (!collectionExists) {
        status[collectionName] = {
          exists: false,
          expected: rules.length,
          existing: 0,
          missing: rules.map((rule) => rule.fields),
        };
        continue;
      }

      // Get existing indexes
      const existing = await collection.indexes();
      const existingKeys = new Set(existing.map((idx) => normalizeIndexKey(idx.key)));

      // Find missing indexes
      const missing = rules
        .filter((rule) => !existingKeys.has(normalizeIndexKey(rule.fields)))
        .map((rule) => rule.fields);

      status[collectionName] = {
        exists: true,
        expected: rules.length,
        existing: existing.length,
        missing: missing,
        missingCount: missing.length,
      };
    } catch (error) {
      status[collectionName] = {
        exists: false,
        error: error.message,
        expected: rules.length,
        existing: 0,
        missing: rules.map((rule) => rule.fields),
      };
    }
  }

  return status;
}

/**
 * Print index status report to console
 *
 * @param {Object} db - MongoDB database instance
 */
export async function printIndexStatus(db) {
  const status = await getIndexStatus(db);

  logger.business("📊 Index Status Report");
  logger.business("═".repeat(60));

  for (const [collectionName, info] of Object.entries(status)) {
    if (info.error) {
      logger.business(`\n❌ ${collectionName}: Error - ${info.error}`);
      continue;
    }

    if (!info.exists) {
      logger.business(`\n⏭️  ${collectionName}: Collection doesn't exist`);
      logger.business(`   Expected: ${info.expected} indexes`);
      continue;
    }

    const statusIcon = info.missingCount === 0 ? "✅" : "⚠️";
    logger.business(`\n${statusIcon} ${collectionName}:`);
    logger.business(`   Expected: ${info.expected} indexes`);
    logger.business(`   Existing: ${info.existing} indexes`);
    logger.business(`   Missing:  ${info.missingCount} indexes`);

    if (info.missingCount > 0) {
      logger.business(`   Missing indexes:`);
      info.missing.forEach((fields) => {
        logger.business(`     - ${JSON.stringify(fields)}`);
      });
    }
  }

  logger.business("\n" + "═".repeat(60));

  // Summary
  const totalExpected = Object.values(status).reduce((sum, info) => sum + info.expected, 0);
  const totalExisting = Object.values(status).reduce((sum, info) => sum + (info.existing || 0), 0);
  const totalMissing = Object.values(status).reduce(
    (sum, info) => sum + (info.missingCount || 0),
    0
  );

  logger.business(`\n📈 Summary:`);
  logger.business(`   Total expected: ${totalExpected} indexes`);
  logger.business(`   Total existing: ${totalExisting} indexes`);
  logger.business(`   Total missing:  ${totalMissing} indexes`);

  if (totalMissing === 0) {
    logger.business(`\n✅ All indexes are in place!`);
  } else {
    logger.business(`\n⚠️  ${totalMissing} index(es) need to be created`);
  }
}
