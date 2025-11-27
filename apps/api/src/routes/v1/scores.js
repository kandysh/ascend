/**
 * @fileoverview Score routes for updating leaderboard scores
 * @module routes/v1/scores
 */

import { Router } from 'express';
import leaderboardService from '../../services/leaderboard.js';
import { asyncHandler, errors } from '../../middleware/errorHandler.js';

const router = Router();

/**
 * @typedef {Object} UpdateScoreBody
 * @property {string} leaderboardId - Leaderboard ID or name
 * @property {string} userId - User ID
 * @property {number} score - Score value (for set mode)
 * @property {number} delta - Score delta (for increment mode)
 * @property {'set' | 'increment'} [mode='set'] - Update mode
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * POST /v1/scores/update
 * Update a user's score on a leaderboard
 */
router.post(
  '/update',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const {
      leaderboardId,
      userId,
      score,
      delta,
      mode = 'set',
      metadata = {},
    } = req.body;

    // Validate required fields
    if (!leaderboardId) {
      throw errors.badRequest('leaderboardId is required');
    }

    if (!userId) {
      throw errors.badRequest('userId is required');
    }

    if (typeof userId !== 'string' || userId.length > 255) {
      throw errors.badRequest('userId must be a string with max 255 characters');
    }

    // Validate score/delta based on mode
    if (mode === 'set') {
      if (typeof score !== 'number' || !Number.isFinite(score)) {
        throw errors.badRequest('score must be a valid number for set mode');
      }
    } else if (mode === 'increment') {
      if (typeof delta !== 'number' || !Number.isFinite(delta)) {
        throw errors.badRequest('delta must be a valid number for increment mode');
      }
    } else {
      throw errors.badRequest('mode must be either "set" or "increment"');
    }

    // Verify leaderboard exists
    let leaderboard = await leaderboardService.getById(tenantId, projectId, leaderboardId);

    // Try by name if not found by ID
    if (!leaderboard) {
      leaderboard = await leaderboardService.getByName(tenantId, projectId, leaderboardId);
    }

    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    // Update score based on mode
    let result;
    if (mode === 'set') {
      result = await leaderboardService.setScore({
        tenantId,
        projectId,
        leaderboardId: leaderboard.id,
        userId,
        score,
        metadata,
      });
    } else {
      result = await leaderboardService.incrementScore({
        tenantId,
        projectId,
        leaderboardId: leaderboard.id,
        userId,
        delta,
        metadata,
      });
    }

    req.log.info(
      {
        leaderboardId: leaderboard.id,
        userId,
        mode,
        score: result.score,
        rank: result.rank,
      },
      'Score updated'
    );

    res.json({
      success: true,
      data: {
        userId: result.userId,
        score: result.score,
        previousScore: result.previousScore,
        rank: result.rank,
        delta: result.delta,
        leaderboardId: leaderboard.id,
        leaderboardName: leaderboard.name,
      },
    });
  })
);

/**
 * POST /v1/scores/batch
 * Update multiple scores in a single request
 */
router.post(
  '/batch',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { leaderboardId, updates } = req.body;

    // Validate required fields
    if (!leaderboardId) {
      throw errors.badRequest('leaderboardId is required');
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      throw errors.badRequest('updates must be a non-empty array');
    }

    if (updates.length > 100) {
      throw errors.badRequest('Maximum 100 updates per batch request');
    }

    // Verify leaderboard exists
    let leaderboard = await leaderboardService.getById(tenantId, projectId, leaderboardId);

    if (!leaderboard) {
      leaderboard = await leaderboardService.getByName(tenantId, projectId, leaderboardId);
    }

    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    // Validate all updates
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];

      if (!update.userId) {
        throw errors.badRequest(`updates[${i}].userId is required`);
      }

      const mode = update.mode || 'set';

      if (mode === 'set') {
        if (typeof update.score !== 'number' || !Number.isFinite(update.score)) {
          throw errors.badRequest(`updates[${i}].score must be a valid number`);
        }
      } else if (mode === 'increment') {
        if (typeof update.delta !== 'number' || !Number.isFinite(update.delta)) {
          throw errors.badRequest(`updates[${i}].delta must be a valid number`);
        }
      } else {
        throw errors.badRequest(`updates[${i}].mode must be "set" or "increment"`);
      }
    }

    // Process all updates
    const results = [];

    for (const update of updates) {
      const mode = update.mode || 'set';

      let result;
      if (mode === 'set') {
        result = await leaderboardService.setScore({
          tenantId,
          projectId,
          leaderboardId: leaderboard.id,
          userId: update.userId,
          score: update.score,
          metadata: update.metadata || {},
        });
      } else {
        result = await leaderboardService.incrementScore({
          tenantId,
          projectId,
          leaderboardId: leaderboard.id,
          userId: update.userId,
          delta: update.delta,
          metadata: update.metadata || {},
        });
      }

      results.push({
        userId: result.userId,
        score: result.score,
        previousScore: result.previousScore,
        rank: result.rank,
        delta: result.delta,
      });
    }

    req.log.info(
      {
        leaderboardId: leaderboard.id,
        count: results.length,
      },
      'Batch score update completed'
    );

    res.json({
      success: true,
      data: {
        leaderboardId: leaderboard.id,
        leaderboardName: leaderboard.name,
        processed: results.length,
        results,
      },
    });
  })
);

/**
 * DELETE /v1/scores/:leaderboardId/:userId
 * Remove a user's score from a leaderboard
 */
router.delete(
  '/:leaderboardId/:userId',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { leaderboardId, userId } = req.params;

    // Verify leaderboard exists
    let leaderboard = await leaderboardService.getById(tenantId, projectId, leaderboardId);

    if (!leaderboard) {
      leaderboard = await leaderboardService.getByName(tenantId, projectId, leaderboardId);
    }

    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    const removed = await leaderboardService.removeUser({
      tenantId,
      projectId,
      leaderboardId: leaderboard.id,
      userId,
    });

    if (!removed) {
      throw errors.notFound('User score');
    }

    req.log.info(
      { leaderboardId: leaderboard.id, userId },
      'User score removed'
    );

    res.json({
      success: true,
      message: 'User score removed from leaderboard',
    });
  })
);

export default router;
