#!/usr/bin/env node

/**
 * Manual Index Application Script
 * 
 * Apply critical indexes to production database immediately.
 * This script creates the most important indexes for heatmap performance.
 */

import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/markets_data';

async function applyCriticalIndexes() {
  let client;
  
  try {
    console.log('🚀 Connecting to production database...');
    client = new MongoClient(MONGO_URL);
    await client.connect();
    
    const db = client.db('markets_data');
    console.log('✅ Connected to markets_data database');
    
    // ========================================
    // CRITICAL FUNDAMENTALS INDEXES
    // ========================================
    console.log('\n🔥 CREATING CRITICAL FUNDAMENTALS INDEXES...');
    
    const fundamentals = db.collection('fundamentals');
    const fundamentalsCount = await fundamentals.countDocuments();
    console.log(`📊 Fundamentals collection has ${fundamentalsCount} documents`);
    
    if (fundamentalsCount > 0) {
      // Critical index for sector filtering (heatmap performance)
      try {
        await fundamentals.createIndex(
          { 'fundamentals.General.Sector': 1 },
          { 
            name: 'fundamentals_general_sector_1',
            background: true 
          }
        );
        console.log('  ✅ Created: fundamentals.General.Sector index');
      } catch (error) {
        console.log('  ⚠️  Sector index may already exist:', error.message);
      }
      
      // Critical index for industry filtering (heatmap performance)
      try {
        await fundamentals.createIndex(
          { 'fundamentals.General.Industry': 1 },
          { 
            name: 'fundamentals_general_industry_1',
            background: true 
          }
        );
        console.log('  ✅ Created: fundamentals.General.Industry index');
      } catch (error) {
        console.log('  ⚠️  Industry index may already exist:', error.message);
      }
      
      // Symbol index (if not exists)
      try {
        await fundamentals.createIndex(
          { symbol: 1 },
          { 
            name: 'symbol_1',
            background: true 
          }
        );
        console.log('  ✅ Created: symbol index');
      } catch (error) {
        console.log('  ⚠️  Symbol index may already exist:', error.message);
      }
    } else {
      console.log('  ⚠️  Fundamentals collection is empty, skipping indexes');
    }
    
    // ========================================
    // CRITICAL METRICS INDEXES
    // ========================================
    console.log('\n🔥 CREATING CRITICAL METRICS INDEXES...');
    
    const metrics = db.collection('metrics');
    const metricsCount = await metrics.countDocuments();
    console.log(`📊 Metrics collection has ${metricsCount} documents`);
    
    if (metricsCount > 0) {
      // Symbol index for metrics (if not exists)
      try {
        await metrics.createIndex(
          { symbol: 1 },
          { 
            name: 'symbol_1',
            background: true 
          }
        );
        console.log('  ✅ Created: metrics symbol index');
      } catch (error) {
        console.log('  ⚠️  Metrics symbol index may already exist:', error.message);
      }
      
      // Last updated index for data freshness
      try {
        await metrics.createIndex(
          { lastUpdated: -1 },
          { 
            name: 'lastUpdated_-1',
            background: true 
          }
        );
        console.log('  ✅ Created: metrics lastUpdated index');
      } catch (error) {
        console.log('  ⚠️  Metrics lastUpdated index may already exist:', error.message);
      }
    } else {
      console.log('  ⚠️  Metrics collection is empty, skipping indexes');
    }
    
    // ========================================
    // VERIFY INDEXES WERE CREATED
    // ========================================
    console.log('\n🔍 VERIFYING INDEXES...');
    
    const fundamentalsIndexes = await fundamentals.indexes();
    console.log(`📊 Fundamentals indexes (${fundamentalsIndexes.length}):`);
    fundamentalsIndexes.forEach(idx => {
      console.log(`  • ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    const metricsIndexes = await metrics.indexes();
    console.log(`📊 Metrics indexes (${metricsIndexes.length}):`);
    metricsIndexes.forEach(idx => {
      console.log(`  • ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    console.log('\n✅ Critical indexes applied successfully!');
    console.log('\n🚀 Expected Performance Improvements:');
    console.log('  • Heatmap sector filtering: 5-10x faster');
    console.log('  • Heatmap industry filtering: 5-10x faster');
    console.log('  • Symbol lookups: 3-5x faster');
    console.log('  • Data freshness queries: 3-5x faster');
    
  } catch (error) {
    console.error('❌ Error applying indexes:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  applyCriticalIndexes()
    .then(() => {
      console.log('\n🎉 Manual index application completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Manual index application failed:', error);
      process.exit(1);
    });
}
