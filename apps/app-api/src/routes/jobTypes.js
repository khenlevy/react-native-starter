import express from 'express';
import {
  getAllJobTypes,
  getJobTypeById,
  getJobTypesByCategory,
  getJobTypesByScope,
  getJobTypesInExecutionOrder,
  getJobTypesWithSchedule,
  getJobTypeStatistics,
  getJobTypesMap,
  getConvenienceJobTypes,
  validateJobTypeDefinition,
} from '../controllers/jobTypesController.js';

const router = express.Router();

// Get all job types with optional filtering
router.get('/', getAllJobTypes);

// Get job types grouped by category
router.get('/categories', getJobTypesByCategory);

// Get job types grouped by scope
router.get('/scopes', getJobTypesByScope);

// Get job types in execution order
router.get('/execution-order', getJobTypesInExecutionOrder);

// Get job types with schedule information
router.get('/schedules', getJobTypesWithSchedule);

// Get job type statistics
router.get('/statistics', getJobTypeStatistics);

// Get job types map for quick lookup
router.get('/map', getJobTypesMap);

// Get convenience job type collections
router.get('/convenience/:type', getConvenienceJobTypes);

// Validate a job type definition
router.post('/validate', validateJobTypeDefinition);

// Get a specific job type by ID
router.get('/:id', getJobTypeById);

export default router;
