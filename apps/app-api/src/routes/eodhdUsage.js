import express from 'express';
import {
  getUsageStats,
  getEndpointStats,
  getRecentUsage,
  getAvailableEndpoints,
  getAvailableJobs,
  getEndpointTypesData,
  getUsageTrends,
  deleteOldRecords,
} from '../controllers/eodhdUsageController.js';

const router = express.Router();

// EODHD API Usage routes
router.get('/stats', getUsageStats);
router.get('/endpoints', getEndpointStats);
router.get('/recent', getRecentUsage);
router.get('/available-endpoints', getAvailableEndpoints);
router.get('/available-jobs', getAvailableJobs);
router.get('/endpoint-types', getEndpointTypesData);
router.get('/trends', getUsageTrends);
router.delete('/cleanup', deleteOldRecords);

export default router;
