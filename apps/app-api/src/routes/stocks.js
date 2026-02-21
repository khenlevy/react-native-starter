import express from 'express';
import {
  getLargeCapStocks,
  getFilterOptions,
  getStockAutocomplete,
  getStockStats,
  getSectors,
  getIndustries,
} from '../controllers/stocksController.js';

const router = express.Router();

// Get large cap stocks with filtering and pagination
router.get('/large-cap', getLargeCapStocks);

// Get filter options for large cap stocks
router.get('/large-cap/filters', getFilterOptions);

// Get stock autocomplete suggestions
router.get('/autocomplete', getStockAutocomplete);

// Get stock statistics
router.get('/large-cap/stats', getStockStats);

// Get available sectors for filtering
router.get('/large-cap/sectors', getSectors);

// Get available industries for filtering
router.get('/large-cap/industries', getIndustries);

export default router;
