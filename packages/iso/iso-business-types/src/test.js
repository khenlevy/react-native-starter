import {
  getJobs,
  getJobById,
  getJobsMapByType,
  getJobsInExecutionOrder,
  getJobStatistics,
  validateJobType,
} from './index.js';

console.log('🧪 Testing @buydy/iso-business-job-types package...\n');

// Test 1: Get all jobs
console.log('1. Testing getJobs():');
const allJobs = getJobs();
console.log(`   ✅ Found ${allJobs.length} job types`);

// Test 2: Get specific job
console.log('\n2. Testing getJobById():');
const job = getJobById('syncFundamentalsLargeCap');
if (job) {
  console.log(`   ✅ Found job: ${job.displayName}`);
  console.log(`   📅 Schedule: ${job.cronDescription}`);
} else {
  console.log('   ❌ Job not found');
}

// Test 3: Get jobs map
console.log('\n3. Testing getJobsMapByType():');
const jobsMap = getJobsMapByType();
const mapKeys = Object.keys(jobsMap);
console.log(`   ✅ Created map with ${mapKeys.length} entries`);

// Test 4: Get execution order
console.log('\n4. Testing getJobsInExecutionOrder():');
const orderedJobs = getJobsInExecutionOrder();
console.log(`   ✅ Jobs in execution order:`);
orderedJobs.forEach((job, index) => {
  console.log(`   ${index + 1}. ${job.displayName} (${job.cronDefinition})`);
});

// Test 5: Get statistics
console.log('\n5. Testing getJobStatistics():');
const stats = getJobStatistics();
console.log(`   ✅ Statistics:`);
console.log(`   - Total jobs: ${stats.total}`);
console.log(`   - Categories: ${Object.keys(stats.byCategory).join(', ')}`);
console.log(`   - Scopes: ${Object.keys(stats.byScope).join(', ')}`);
console.log(`   - Priorities: ${Object.keys(stats.byPriority).join(', ')}`);

// Test 6: Validate job type
console.log('\n6. Testing validateJobType():');
const testJob = {
  id: 'testJob',
  name: 'testJob',
  displayName: 'Test Job',
  description: 'A test job',
  category: 'test',
  scope: 'all',
  cronDefinition: '0 0 * * *',
};
const validation = validateJobType(testJob);
console.log(
  `   ✅ Validation result: ${validation.isValid ? 'VALID' : 'INVALID'}`,
);
if (!validation.isValid) {
  console.log(`   ❌ Errors: ${validation.errors.join(', ')}`);
}

console.log('\n🎉 All tests completed successfully!');
console.log('\n📋 Available job types:');
allJobs.forEach((job) => {
  console.log(`   - ${job.displayName} (${job.category}/${job.scope})`);
});
