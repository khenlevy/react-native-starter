#!/usr/bin/env node

import { validateEnvironmentSymlinks, getFixInstructions } from '../src/index.js';

/**
 * Format and display validation results
 */
function displayResults(results) {
  console.log('🔍 Validating environment file symlinks...\n');

  for (const result of results) {
    if (result.valid) {
      console.log(`✅ ${result.app}: All environment symlinks valid`);
    } else {
      console.log(`❌ ${result.app}:`);
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }
  }

  console.log('');
}

/**
 * Main execution
 */
async function main() {
  try {
    const { allValid, results } = validateEnvironmentSymlinks();

    displayResults(results);

    if (!allValid) {
      console.log('❌ Validation failed! Some apps are missing proper environment symlinks.');
      console.log('\n' + getFixInstructions());
      process.exit(1);
    }

    console.log('✅ All apps have valid environment symlinks!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during validation:', error.message);
    process.exit(1);
  }
}

main();

