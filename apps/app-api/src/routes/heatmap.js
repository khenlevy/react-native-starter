import express from 'express';
import {
  getHeatmapData,
  getAllSectors,
  getAllIndustries,
  getAvailableMetrics,
} from '../controllers/heatmapController.js';
import {
  filterPriceRange,
  getSymbolPricePosition,
} from '../controllers/priceRangeController.js';
import { bulkLoadPriceRangeData } from '../controllers/priceRangeBulkController.js';

const router = express.Router();

// Get heatmap data for visualization
router.get('/', getHeatmapData);

// Helper endpoints for filters
router.get('/sectors', getAllSectors);
router.get('/industries', getAllIndustries);
router.get('/available', getAvailableMetrics);

// Price range filtering endpoints
router.post('/price-range/filter', filterPriceRange);
router.post('/price-range/bulk', bulkLoadPriceRangeData);
router.get('/price-range/position/:symbol', getSymbolPricePosition);

export default router;
