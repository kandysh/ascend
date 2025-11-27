/**
 * @fileoverview V1 API routes aggregator
 * @module routes/v1
 */

import { Router } from 'express';
import scoresRouter from './scores.js';
import leaderboardsRouter from './leaderboards.js';
import usageRouter from './usage.js';

const router = Router();

/**
 * Mount all v1 routes
 */
router.use('/scores', scoresRouter);
router.use('/leaderboards', leaderboardsRouter);
router.use('/usage', usageRouter);

export default router;
