#!/usr/bin/env node

/**
 * Test script to run a job via the API
 * Usage: node src/test-run-job.js <job-id>
 */

import fetch from 'node-fetch';
import logger from '@buydy/se-logger';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

async function testRunJob(jobId) {
  try {
    logger.business(`🧪 Testing run job for ID: ${jobId}`);
    logger.business(`📍 API URL: ${API_BASE_URL}`);

    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (response.ok) {
      logger.business('✅ Job execution triggered successfully!');
      logger.business('📊 Response:', JSON.stringify(result, null, 2));
    } else {
      logger.business('❌ Failed to trigger job execution');
      logger.business('📊 Error:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    logger.business('💥 Error testing run job', { error: error.message });
  }
}

// Get job ID from command line arguments
const jobId = process.argv[2];

if (!jobId) {
  logger.business('Usage: node src/test-run-job.js <job-id>');
  logger.business('Example: node src/test-run-job.js 507f1f77bcf86cd799439011');
  process.exit(1);
}

testRunJob(jobId);
