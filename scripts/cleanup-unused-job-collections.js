#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import logger from '@buydy/se-logger';

// Load environment variables from the app directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appDir = resolve(__dirname, '../apps/app-stocks-scanner');
const envPath = resolve(appDir, '.env');
dotenv.config({ path: envPath });

// Use the same MongoDB connection logic as the main app
const host = process.env.MONGO_HOST || "localhost";
const port = process.env.MONGO_PORT || 27017;
const database = process.env.MONGO_DATABASE || "buydy";
const username = process.env.MONGO_USERNAME;
const password = process.env.MONGO_PASSWORD;

let MONGODB_URI;
if (username && password) {
  // Handle MongoDB Atlas connections (no port needed)
  if (host.includes('mongodb.net')) {
    MONGODB_URI = `mongodb+srv://${username}:${password}@${host}/${database}?retryWrites=true&w=majority`;
  } else {
    MONGODB_URI = `mongodb://${username}:${password}@${host}:${port}/${database}`;
  }
} else {
  MONGODB_URI = `mongodb://${host}:${port}/${database}`;
}

const UNUSED_COLLECTIONS = [
  'jobs_clean',
  'jobs_empty', 
  'jobs_final',
  'jobs_new',
  'jobs_temp'
];

async function cleanupUnusedJobCollections() {
  let client;
  
  try {
    logger.business('Connecting to MongoDB', { host, port, database });
    logger.connection('Connecting to MongoDB', MONGODB_URI);
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    logger.business('Checking current collections');
    const allCollections = await db.listCollections().toArray();
    const collectionNames = allCollections.map(c => c.name);
    
    logger.business('Collections found', { count: collectionNames.length });
    
    // Check which unused collections exist
    const existingUnusedCollections = UNUSED_COLLECTIONS.filter(name => 
      collectionNames.includes(name)
    );
    
    if (existingUnusedCollections.length === 0) {
      logger.business('No unused job collections found - nothing to clean up');
      return;
    }
    
    logger.business('Found unused job collections to remove', { 
      count: existingUnusedCollections.length,
      collections: existingUnusedCollections 
    });
    
    // Remove each unused collection
    for (const collectionName of existingUnusedCollections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        
        logger.business('Removing collection', { 
          collectionName, 
          documentCount: count 
        });
        await db.dropCollection(collectionName);
        logger.business('Successfully removed collection', { collectionName });
        
      } catch (error) {
        logger.business('Failed to remove collection', { 
          collectionName, 
          error: error.message 
        });
      }
    }
    
    logger.business('Cleanup completed', { 
      removedCount: existingUnusedCollections.length,
      message: 'Only the main "jobs" collection remains (as intended)'
    });
    
  } catch (error) {
    logger.business('Error during cleanup', { error: error.message });
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      logger.business('MongoDB connection closed');
    }
  }
}

// Run the cleanup script
cleanupUnusedJobCollections();
