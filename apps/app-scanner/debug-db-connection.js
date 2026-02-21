#!/usr/bin/env node

/**
 * Database Connection Debug Script
 * 
 * This script helps debug database connection issues by:
 * 1. Testing database connection
 * 2. Validating Mongoose models
 * 3. Testing basic operations
 * 4. Simulating the syncExchangesAndSymbols job locally
 */

import { getDatabase, Exchange, ExchangeSymbols, Fundamentals } from '@buydy/se-db';
import { TrackedEODHDClient } from '@buydy/se-eodhd';

const log = console.log;

async function testDatabaseConnection() {
  log('\x1b[36m🔍 Testing Database Connection...\x1b[0m');
  
  try {
    // Test 1: Get database connection
    log('   📡 Getting database connection...');
    const db = await getDatabase();
    log('   ✅ Database connection established');
    
    // Test 2: Test basic collections
    log('   📋 Testing collections...');
    const exchangesColl = db.collection('exchanges');
    const exchangeSymbolsColl = db.collection('exchange_symbols');
    const fundamentalsColl = db.collection('fundamentals');
    log('   ✅ Collections accessible');
    
    // Test 3: Test basic query
    log('   🔍 Testing basic query...');
    const exchangeCount = await exchangesColl.countDocuments();
    log(`   ✅ Found ${exchangeCount} exchanges in database`);
    
    // Test 4: Test exchange symbols query
    log('   🔍 Testing exchange symbols query...');
    const symbolsCount = await exchangeSymbolsColl.countDocuments();
    log(`   ✅ Found ${symbolsCount} exchange symbol documents`);
    
    // Test 5: Test specific exchange query (like in the failing job)
    log('   🔍 Testing specific exchange query...');
    const exchanges = await exchangesColl.find({}).project({ code: 1, Name: 1, Country: 1, Currency: 1 }).limit(5).toArray();
    log(`   ✅ Retrieved ${exchanges.length} exchanges with select fields`);
    
    if (exchanges.length > 0) {
      const firstExchange = exchanges[0];
      log(`   📊 Sample exchange: ${firstExchange.code} - ${firstExchange.Name}`);
      
      // Test 6: Test exchange symbols for first exchange
      log('   🔍 Testing exchange symbols for first exchange...');
      const exchangeSymbols = await exchangeSymbolsColl.findOne({ exchangeCode: firstExchange.code });
      if (exchangeSymbols) {
        log(`   ✅ Found ${exchangeSymbols.symbols?.length || 0} symbols for ${firstExchange.code}`);
      } else {
        log(`   ⚠️  No symbols found for ${firstExchange.code}`);
      }
    }
    
    log('   ✅ All database tests passed successfully');
    
    return true;
  } catch (error) {
    log(`   ❌ Database connection test failed: ${error.message}`);
    log(`   📋 Error details: ${error.stack || 'No stack trace available'}`);
    
    if (error.message.includes('Client must be connected')) {
      log('   🔍 This is the same error you\'re seeing in production!');
      log('   💡 Possible causes:');
      log('      - MongoDB connection string is incorrect');
      log('      - MongoDB server is not running');
      log('      - Network connectivity issues');
      log('      - Authentication problems');
    }
    
    return false;
  }
}

async function testEODHDConnection() {
  log('\x1b[36m🔍 Testing EODHD API Connection...\x1b[0m');
  
  try {
    const client = new TrackedEODHDClient({
      apiKey: process.env.API_EODHD_API_TOKEN,
      maxCallsPerMin: 1000,
      jobName: "debug-db-connection",
    });
    
    log('   📡 Testing EODHD API...');
    const exchanges = await client.search.getAvailableExchanges();
    log(`   ✅ Retrieved ${exchanges.length} exchanges from EODHD API`);
    
    if (exchanges.length > 0) {
      const firstExchange = exchanges[0];
      log(`   📊 Sample exchange from API: ${firstExchange.Code} - ${firstExchange.Name}`);
    }
    
    return true;
  } catch (error) {
    log(`   ❌ EODHD API test failed: ${error.message}`);
    log(`   📋 Error details: ${error.stack || 'No stack trace available'}`);
    
    if (!process.env.API_EODHD_API_TOKEN) {
      log('   💡 API_EODHD_API_TOKEN environment variable is not set');
    }
    
    return false;
  }
}

async function simulateSyncExchanges() {
  log('\x1b[36m🔍 Simulating syncExchangesAndSymbols Job...\x1b[0m');
  
  try {
    const db = await getDatabase();
    const exchangesColl = db.collection('exchanges');
    const exchangeSymbolsColl = db.collection('exchange_symbols');
    
    // Test the exact same operations as the failing job
    log('   📡 Testing exchange query (same as failing job)...');
    const exchanges = await exchangesColl.find({}).project({ code: 1 }).toArray();
    log(`   ✅ Retrieved ${exchanges.length} exchanges`);
    
    // Test a few exchanges
    const testExchanges = exchanges.slice(0, 3);
    
    for (const exchange of testExchanges) {
      try {
        log(`   🔍 Testing exchange: ${exchange.code}`);
        
        // Test the exact query from the failing job
        const existing = await exchangeSymbolsColl.findOne({ exchangeCode: exchange.code }, { projection: { fetchedAt: 1 } });
        log(`   ✅ Exchange symbols query successful for ${exchange.code}`);
        
        if (existing) {
          log(`   📅 Last fetched: ${existing.fetchedAt}`);
        } else {
          log(`   ⚠️  No symbols document found for ${exchange.code}`);
        }
        
      } catch (error) {
        log(`   ❌ Failed for exchange ${exchange.code}: ${error.message}`);
        if (error.message.includes('Client must be connected')) {
          log(`   🔍 This is the exact error you're seeing in production!`);
        }
      }
    }
    
    return true;
  } catch (error) {
    log(`   ❌ Simulation failed: ${error.message}`);
    log(`   📋 Error details: ${error.stack || 'No stack trace available'}`);
    return false;
  }
}

async function checkEnvironmentVariables() {
  log('\x1b[36m🔍 Checking Environment Variables...\x1b[0m');
  
  const requiredVars = [
    'MONGO_URL',
    'MONGO_HOST',
    'MONGO_USERNAME',
    'MONGO_PASSWORD',
    'MONGO_DATABASE',
    'API_EODHD_API_TOKEN'
  ];
  
  const missingVars = [];
  const presentVars = [];
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      presentVars.push(varName);
      // Mask sensitive values
      const value = varName.includes('PASSWORD') || varName.includes('TOKEN') 
        ? '***' + process.env[varName].slice(-3)
        : process.env[varName];
      log(`   ✅ ${varName}: ${value}`);
    } else {
      missingVars.push(varName);
      log(`   ❌ ${varName}: Not set`);
    }
  }
  
  if (missingVars.length > 0) {
    log(`\n   ⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    log('   💡 Set these variables in your .env file or environment');
  }
  
  return missingVars.length === 0;
}

async function main() {
  log('\x1b[32m🚀 Database Connection Debug Script\x1b[0m');
  log('=====================================\n');
  
  // Check environment variables
  const envOk = await checkEnvironmentVariables();
  log('');
  
  if (!envOk) {
    log('\x1b[31m❌ Environment variables are missing. Please set them before running the job.\x1b[0m');
    process.exit(1);
  }
  
  // Test database connection
  const dbOk = await testDatabaseConnection();
  log('');
  
  if (!dbOk) {
    log('\x1b[31m❌ Database connection failed. Please check your MongoDB settings.\x1b[0m');
    process.exit(1);
  }
  
  // Test EODHD API connection
  const apiOk = await testEODHDConnection();
  log('');
  
  // Simulate the failing job
  const simulationOk = await simulateSyncExchanges();
  log('');
  
  // Summary
  log('\x1b[36m📊 Summary:\x1b[0m');
  log(`   Database Connection: ${dbOk ? '✅ OK' : '❌ FAILED'}`);
  log(`   EODHD API Connection: ${apiOk ? '✅ OK' : '❌ FAILED'}`);
  log(`   Job Simulation: ${simulationOk ? '✅ OK' : '❌ FAILED'}`);
  
  if (dbOk && apiOk && simulationOk) {
    log('\n\x1b[32m🎉 All tests passed! The issue might be environment-specific.\x1b[0m');
    log('   💡 Try running this script in the same environment where the job fails.');
  } else {
    log('\n\x1b[31m❌ Some tests failed. Please fix the issues above.\x1b[0m');
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`\n\x1b[31m❌ Script failed: ${error.message}\x1b[0m`);
    log(`\x1b[31m${error.stack}\x1b[0m`);
    process.exit(1);
  });
}
