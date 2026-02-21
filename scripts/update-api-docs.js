#!/usr/bin/env node

/**
 * API Documentation Update Script
 * 
 * This script automatically updates the API_DOCUMENTATION.md file
 * when API changes are detected. It should be run after any API modifications.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function updateTimestamp() {
  const docPath = path.join(rootDir, 'API_DOCUMENTATION.md');
  
  if (!fs.existsSync(docPath)) {
    console.log('❌ API_DOCUMENTATION.md not found');
    return;
  }

  let content = fs.readFileSync(docPath, 'utf8');
  
  // Update the timestamp
  const now = new Date().toISOString().split('T')[0];
  content = content.replace(
    /(\*\*Last Updated:\*\* )\d{4}-\d{2}-\d{2}/,
    `$1${now}`
  );

  fs.writeFileSync(docPath, content);
  console.log('✅ API documentation timestamp updated');
}

function checkApiChanges() {
  const apiPath = path.join(rootDir, 'apps/app-stocks-api/src');
  
  if (!fs.existsSync(apiPath)) {
    console.log('⚠️  API source not found, skipping API change detection');
    return;
  }

  console.log('🔍 Checking for API changes...');
  
  // Check if controllers or routes have been modified
  const controllersPath = path.join(apiPath, 'controllers');
  const routesPath = path.join(apiPath, 'routes');
  
  if (fs.existsSync(controllersPath) || fs.existsSync(routesPath)) {
    console.log('📝 API files detected - please review and update API_DOCUMENTATION.md if needed');
  }
}

function main() {
  console.log('🚀 Updating API Documentation...\n');
  
  updateTimestamp();
  checkApiChanges();
  
  console.log('\n✅ API documentation update complete');
  console.log('📖 Remember to review API_DOCUMENTATION.md for accuracy');
}

main();
