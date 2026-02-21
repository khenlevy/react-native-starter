import express from 'express';
import {
  getAllJobs,
  getJobById,
  getRecentJobs,
  getRunningJobs,
  getFailedJobs,
  getJobHistory,
  createJob,
  updateJob,
  runJob,
  deleteJob,
  deleteAllJobs,
  getJobStats,
  getJobsByType,
} from '../controllers/jobsController.js';
import {
  getCycledListStatus,
  pauseCycledList,
  resumeCycledList,
} from '../controllers/cycledListController.js';

const router = express.Router();

// Statistics endpoint
router.get('/stats', getJobStats);

// Cycled list status endpoints
router.get('/cycled-list-status', getCycledListStatus);
router.post('/cycled-list-status/pause', pauseCycledList);
router.post('/cycled-list-status/resume', resumeCycledList);

// Specialized endpoints
router.get('/recent', getRecentJobs);
router.get('/running', getRunningJobs);
router.get('/failed', getFailedJobs);
router.get('/types', getJobsByType);
router.get('/history/:name', getJobHistory);

// CRUD operations
router.get('/', getAllJobs);
router.get('/:id', getJobById);
router.post('/', createJob);
router.put('/:id', updateJob);
router.post('/:id/run', runJob);
router.delete('/all', deleteAllJobs);
router.delete('/:id', deleteJob);

export default router;
