import { ensureConnected, Jobs } from '@buydy/se-db';
import logger from '@buydy/se-logger';

async function checkDatabase() {
  try {
    logger.business('🔍 Checking database connection and Jobs collection...');

    // Ensure connection
    await ensureConnected();
    logger.business('✅ Connected to MongoDB');

    // Check if Jobs collection exists and has data
    const jobCount = await Jobs.countDocuments();
    logger.business(`📊 Jobs collection has ${jobCount} documents`);

    if (jobCount === 0) {
      logger.business('📝 Creating sample jobs in the database...');

      // Create some sample jobs
      const sampleJobs = [
        {
          name: 'Large Cap Analysis',
          status: 'running',
          scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
          progress: 0.75,
          logs: [
            {
              ts: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
              level: 'info',
              msg: 'Starting large cap analysis...',
            },
            {
              ts: new Date(Date.now() - 1 * 60 * 60 * 1000),
              level: 'info',
              msg: 'Processing 500 companies...',
            },
          ],
          metadata: {
            description:
              'Analyze large cap stocks for investment opportunities',
            type: 'analysis',
            priority: 'high',
          },
        },
        {
          name: 'Dividend Scanner',
          status: 'completed',
          scheduledAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          endedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          progress: 1.0,
          result: {
            processed: 1250,
            success: 1200,
            failed: 50,
            totalDividends: 45000,
          },
          logs: [
            {
              ts: new Date(Date.now() - 4 * 60 * 60 * 1000),
              level: 'info',
              msg: 'Starting dividend scan...',
            },
            {
              ts: new Date(Date.now() - 3 * 60 * 60 * 1000),
              level: 'info',
              msg: 'Scan completed successfully',
            },
          ],
          metadata: {
            description: 'Scan all stocks for dividend information',
            type: 'scanner',
            priority: 'medium',
          },
        },
        {
          name: 'Technical Analysis',
          status: 'failed',
          scheduledAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
          endedAt: new Date(Date.now() - 5.75 * 60 * 60 * 1000),
          progress: 0.0,
          error: 'API rate limit exceeded - too many requests',
          logs: [
            {
              ts: new Date(Date.now() - 6 * 60 * 60 * 1000),
              level: 'info',
              msg: 'Starting technical analysis...',
            },
            {
              ts: new Date(Date.now() - 5.75 * 60 * 60 * 1000),
              level: 'error',
              msg: 'API rate limit exceeded - too many requests',
            },
          ],
          metadata: {
            description: 'Perform technical analysis on selected stocks',
            type: 'analysis',
            priority: 'high',
          },
        },
      ];

      // Insert sample jobs
      for (const jobData of sampleJobs) {
        const job = new Jobs(jobData);
        await job.save();
        logger.business(`✅ Created job: ${jobData.name}`);
      }

      logger.business('🎉 Sample jobs created successfully!');
    } else {
      // Show existing jobs
      const jobs = await Jobs.find().limit(5).select('name status scheduledAt');
      logger.business('📋 Existing jobs:');
      jobs.forEach((job) => {
        logger.business(`  - ${job.name} (${job.status}) - ${job.scheduledAt}`);
      });
    }

    process.exit(0);
  } catch (error) {
    logger.business('❌ Error', { error: error.message });
    process.exit(1);
  }
}

checkDatabase();
