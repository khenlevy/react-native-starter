import express from 'express';
import { calculateRanking } from '../controllers/rankingController.js';

const router = express.Router();

// Calculate ranking for companies
router.post('/calculate', calculateRanking);

export default router;
