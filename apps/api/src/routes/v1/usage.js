/**
 * @fileoverview Usage routes for API usage tracking and reporting
 * @module routes/v1/usage
 */

import { Router } from 'express';
import usageService from '../../services/usage.js';
import { asyncHandler, errors } from '../../middleware/errorHandler.js';
import logger from '../../utils/logger.js';

const router = Router();

/**
 * @route GET /v1/usage
 * @description Get current month's usage statistics
 * @access Private (requires API key)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { tenantId, plan } = req.tenant;

    const usage = await usageService.getCurrentUsage(tenantId, plan);

    req.log.debug({ tenantId, usage }, 'Usage retrieved');

    res.json({
      success: true,
      data: usage,
    });
  })
);

/**
 * @route GET /v1/usage/history
 * @description Get usage history for past months
 * @access Private (requires API key)
 * @query {number} [months=6] - Number of months to retrieve
 */
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const { tenantId } = req.tenant;
    const months = Math.min(parseInt(req.query.months || '6', 10), 24);

    if (months < 1 || isNaN(months)) {
      throw errors.badRequest('Invalid months parameter. Must be between 1 and 24.');
    }

    const history = await usageService.getUsageHistory(tenantId, months);

    res.json({
      success: true,
      data: {
        history,
        months,
      },
    });
  })
);

/**
 * @route GET /v1/usage/daily
 * @description Get daily usage breakdown for current month
 * @access Private (requires API key)
 */
router.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const { tenantId } = req.tenant;

    const dailyUsage = await usageService.getDailyUsage(tenantId);

    res.json({
      success: true,
      data: {
        daily: dailyUsage,
      },
    });
  })
);

/**
 * @route GET /v1/usage/breakdown
 * @description Get usage breakdown by leaderboard
 * @access Private (requires API key)
 * @query {string} [month] - Month to query (YYYY-MM format)
 */
router.get(
  '/breakdown',
  asyncHandler(async (req, res) => {
    const { tenantId } = req.tenant;
    const { month } = req.query;

    // Validate month format if provided
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      throw errors.badRequest('Invalid month format. Use YYYY-MM format.');
    }

    const breakdown = await usageService.getUsageByLeaderboard(tenantId, month || null);

    res.json({
      success: true,
      data: {
        breakdown,
        month: month || new Date().toISOString().slice(0, 7),
      },
    });
  })
);

/**
 * @route GET /v1/usage/limit
 * @description Check if tenant has exceeded usage limits
 * @access Private (requires API key)
 */
router.get(
  '/limit',
  asyncHandler(async (req, res) => {
    const { tenantId, plan } = req.tenant;

    const limitStatus = await usageService.checkLimit(tenantId, plan);

    res.json({
      success: true,
      data: {
        ...limitStatus,
        plan,
        exceeded: limitStatus.exceeded,
      },
    });
  })
);

export default router;
