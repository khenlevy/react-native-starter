#!/usr/bin/env node

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/buydy';

async function clearJobsCollection() {
  let client;
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    const jobsCollection = db.collection('jobs');
    
    // Count existing jobs
    const count = await jobsCollection.countDocuments();
    console.log(`📊 Found ${count} jobs in the collection`);
    
    if (count === 0) {
      console.log('✅ No jobs to clear');
      return;
    }
    
    // Delete all jobs
    console.log('🗑️  Clearing all jobs...');
    const result = await jobsCollection.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} jobs`);
    
    // Verify the collection is empty
    const remainingCount = await jobsCollection.countDocuments();
    if (remainingCount === 0) {
      console.log('🎉 Jobs collection is now empty');
    } else {
      console.log(`⚠️  Warning: ${remainingCount} jobs still remain`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing jobs collection:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the script
clearJobsCollection();
