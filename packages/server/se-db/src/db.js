// src/db.js
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import logger from "@buydy/se-logger";
import { ensureIndexes } from "./indexes/index.js";

let clientPromise = null;
let globalDb = null;

function buildMongoUrl() {
  const host = process.env.MONGO_HOST || "localhost";
  const port = process.env.MONGO_PORT || 27017;
  const username = process.env.MONGO_USERNAME;
  const password = process.env.MONGO_PASSWORD;
  const database = process.env.MONGO_DATABASE || "markets_data";

  // If MONGO_URL is provided, use it but add credentials if they exist and aren't already in URL
  if (process.env.MONGO_URL) {
    let url = process.env.MONGO_URL;

    // Check if URL already has credentials
    const hasAuth =
      url.includes("@") && (url.includes("mongodb://") || url.includes("mongodb+srv://"));

    // If credentials are provided but not in URL, add them
    if (!hasAuth && username && password) {
      // Parse and rebuild URL with credentials
      if (url.includes("mongodb+srv://")) {
        // For mongodb+srv, credentials go after the protocol
        url = url.replace("mongodb+srv://", `mongodb+srv://${username}:${password}@`);
      } else if (url.includes("mongodb://")) {
        // For mongodb://, credentials go after the protocol
        const match = url.match(/^mongodb:\/\/([^/]+)/);
        if (match) {
          const restOfUrl = url.substring(match[0].length);
          url = `mongodb://${username}:${password}@${match[1]}${restOfUrl}`;
        }
      }

      // Add authSource if not already present
      if (!url.includes("authSource=")) {
        url += (url.includes("?") ? "&" : "?") + "authSource=admin";
      }
    }

    return { url, dbName: database };
  }

  if (host.includes(".mongodb.net")) {
    return {
      url: `mongodb+srv://${username}:${password}@${host}/?retryWrites=true&w=majority`,
      dbName: database,
    };
  }

  // Build URL with authentication if credentials are provided
  let url = `mongodb://`;
  if (username && password) {
    url += `${username}:${password}@`;
    url += `${host}:${port}/${database}?authSource=admin`;
  } else {
    url += `${host}:${port}`;
  }

  return {
    url,
    dbName: database,
  };
}

export async function getDatabase() {
  if (globalDb && mongoose.connection.readyState === 1) {
    return globalDb;
  }

  if (!clientPromise) {
    const { url, dbName } = buildMongoUrl();

    logger.business("🔗 Connecting to MongoDB...");

    // Connect both MongoClient and Mongoose, waiting for both
    clientPromise = Promise.all([
      // MongoClient connection
      new MongoClient(url, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        retryWrites: true,
        retryReads: true,
        maxPoolSize: 20,
      }).connect(),
      // Mongoose connection
      (() => {
        mongoose.set("strictQuery", true);
        return mongoose.connect(url, {
          dbName,
          serverSelectionTimeoutMS: 30000,
          connectTimeoutMS: 30000,
          maxPoolSize: 20,
        });
      })(),
    ])
      .then(async ([client]) => {
        logger.business("✅ MongoClient connected");
        logger.business("✅ Mongoose connected");
        globalDb = client.db(dbName);

        // Ensure indexes exist (non-blocking, errors don't break connection)
        // SAFETY: This only creates indexes, never modifies or deletes data
        // Uses fast-path optimization: skips full check if indexes already complete
        ensureIndexes(globalDb, { skipQuickCheck: false }).catch((err) => {
          logger.business("⚠️  Index management error (non-fatal, no data loss)", {
            error: err.message,
          });
        });

        return globalDb;
      })
      .catch((err) => {
        logger.business("❌ MongoDB connection error", { error: err.message });
        clientPromise = null;
        throw err;
      });
  }

  return clientPromise;
}

export async function ensureConnected() {
  // Ensure both connections are established
  if (mongoose.connection.readyState !== 1 || !globalDb) {
    await getDatabase();
  }

  // Double-check Mongoose is connected
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Mongoose connection is not in connected state");
  }

  return true;
}

export async function closeDatabase() {
  if (clientPromise) {
    const db = await clientPromise;
    await db.client?.close?.();
    await mongoose.disconnect();
    clientPromise = null;
    globalDb = null;
    logger.business("✅ Closed MongoDB and Mongoose");
  }
}
