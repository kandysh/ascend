/**
 * @fileoverview Leaderboard routes for CRUD and ranking operations
 * @module routes/v1/leaderboards
 */

import { Router } from 'express';
import leaderboardService from '../../services/leaderboard.js';
import { asyncHandler, errors } from '../../middleware/errorHandler.js';

const router = Router();

/**
 * @route POST /v1/leaderboards
 * @description Create a new leaderboard
 * @body {name: string, description?: string, sortOrder?: 'asc' | 'desc', metadata?: object}
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { name, description, sortOrder, metadata } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw errors.badRequest('Leaderboard name is required');
    }

    if (name.length > 255) {
      throw errors.badRequest('Leaderboard name must be 255 characters or less');
    }

    if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
      throw errors.badRequest('Sort order must be "asc" or "desc"');
    }

    // Check if leaderboard with same name already exists
    const existing = await leaderboardService.getByName(tenantId, projectId, name.trim());
    if (existing) {
      throw errors.conflict(`Leaderboard with name "${name}" already exists`);
    }

    const leaderboard = await leaderboardService.create({
      tenantId,
      projectId,
      name: name.trim(),
      description: description || '',
      sortOrder: sortOrder || 'desc',
      metadata: metadata || {},
    });

    req.log.info({ leaderboardId: leaderboard.id }, 'Leaderboard created');

    res.status(201).json({
      success: true,
      data: leaderboard,
    });
  })
);

/**
 * @route GET /v1/leaderboards
 * @description List all leaderboards for the project
 * @query {limit?: number, offset?: number}
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const { leaderboards, total } = await leaderboardService.list(tenantId, projectId, {
      limit,
      offset,
    });

    res.json({
      success: true,
      data: leaderboards,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + leaderboards.length < total,
      },
    });
  })
);

/**
 * @route GET /v1/leaderboards/:id
 * @description Get a specific leaderboard
 * @param {string} id - Leaderboard ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { id } = req.params;

    const leaderboard = await leaderboardService.getById(tenantId, projectId, id);

    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    // Get stats for the leaderboard
    const stats = await leaderboardService.getStats({
      tenantId,
      projectId,
      leaderboardId: id,
    });

    res.json({
      success: true,
      data: {
        ...leaderboard,
        stats,
      },
    });
  })
);

/**
 * @route DELETE /v1/leaderboards/:id
 * @description Delete a leaderboard
 * @param {string} id - Leaderboard ID
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { id } = req.params;

    const deleted = await leaderboardService.delete(tenantId, projectId, id);

    if (!deleted) {
      throw errors.notFound('Leaderboard');
    }

    req.log.info({ leaderboardId: id }, 'Leaderboard deleted');

    res.json({
      success: true,
      message: 'Leaderboard deleted successfully',
    });
  })
);

/**
 * @route GET /v1/leaderboards/:id/top
 * @description Get top entries from a leaderboard
 * @param {string} id - Leaderboard ID
 * @query {limit?: number, offset?: number, order?: 'asc' | 'desc'}
 */
router.get(
  '/:id/top',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const order = req.query.order || 'desc';

    if (!['asc', 'desc'].includes(order)) {
      throw errors.badRequest('Order must be "asc" or "desc"');
    }

    // Verify leaderboard exists
    const leaderboard = await leaderboardService.getById(tenantId, projectId, id);
    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    const { entries, total } = await leaderboardService.getTopScores({
      tenantId,
      projectId,
      leaderboardId: id,
      limit,
      offset,
      order: leaderboard.sortOrder || order,
    });

    res.json({
      success: true,
      data: {
        leaderboard: {
          id: leaderboard.id,
          name: leaderboard.name,
        },
        entries,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + entries.length < total,
        },
      },
    });
  })
);

/**
 * @route GET /v1/leaderboards/:id/rank/:userId
 * @description Get a specific user's rank and score
 * @param {string} id - Leaderboard ID
 * @param {string} userId - User ID
 */
router.get(
  '/:id/rank/:userId',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { id, userId } = req.params;

    // Verify leaderboard exists
    const leaderboard = await leaderboardService.getById(tenantId, projectId, id);
    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    const entry = await leaderboardService.getUserRank({
      tenantId,
      projectId,
      leaderboardId: id,
      userId,
      order: leaderboard.sortOrder || 'desc',
    });

    if (!entry) {
      throw errors.notFound('User not found in leaderboard');
    }

    res.json({
      success: true,
      data: {
        leaderboard: {
          id: leaderboard.id,
          name: leaderboard.name,
        },
        entry,
      },
    });
  })
);

/**
 * @route POST /v1/leaderboards/:id/ranks
 * @description Get multiple users' ranks and scores
 * @param {string} id - Leaderboard ID
 * @body {userIds: string[]}
 */
router.post(
  '/:id/ranks',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { id } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw errors.badRequest('userIds must be a non-empty array');
    }

    if (userIds.length > 100) {
      throw errors.badRequest('Maximum 100 userIds allowed per request');
    }

    // Verify leaderboard exists
    const leaderboard = await leaderboardService.getById(tenantId, projectId, id);
    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    const entries = await leaderboardService.getUsersRanks({
      tenantId,
      projectId,
      leaderboardId: id,
      userIds,
      order: leaderboard.sortOrder || 'desc',
    });

    res.json({
      success: true,
      data: {
        leaderboard: {
          id: leaderboard.id,
          name: leaderboard.name,
        },
        entries,
        notFound: userIds.filter((uid) => !entries.find((e) => e.userId === uid)),
      },
    });
  })
);

/**
 * @route GET /v1/leaderboards/:id/around/:userId
 * @description Get entries around a specific user
 * @param {string} id - Leaderboard ID
 * @param {string} userId - User ID
 * @query {range?: number} - Number of entries above and below (default: 5, max: 25)
 */
router.get(
  '/:id/around/:userId',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { id, userId } = req.params;
    const range = Math.min(parseInt(req.query.range, 10) || 5, 25);

    // Verify leaderboard exists
    const leaderboard = await leaderboardService.getById(tenantId, projectId, id);
    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    const { entries, userRank } = await leaderboardService.getAroundUser({
      tenantId,
      projectId,
      leaderboardId: id,
      userId,
      range,
      order: leaderboard.sortOrder || 'desc',
    });

    if (userRank === null) {
      throw errors.notFound('User not found in leaderboard');
    }

    res.json({
      success: true,
      data: {
        leaderboard: {
          id: leaderboard.id,
          name: leaderboard.name,
        },
        userRank,
        entries,
      },
    });
  })
);

/**
 * @route DELETE /v1/leaderboards/:id/users/:userId
 * @description Remove a user from the leaderboard
 * @param {string} id - Leaderboard ID
 * @param {string} userId - User ID
 */
router.delete(
  '/:id/users/:userId',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { id, userId } = req.params;

    // Verify leaderboard exists
    const leaderboard = await leaderboardService.getById(tenantId, projectId, id);
    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    const removed = await leaderboardService.removeUser({
      tenantId,
      projectId,
      leaderboardId: id,
      userId,
    });

    if (!removed) {
      throw errors.notFound('User not found in leaderboard');
    }

    req.log.info({ leaderboardId: id, userId }, 'User removed from leaderboard');

    res.json({
      success: true,
      message: 'User removed from leaderboard',
    });
  })
);

/**
 * @route GET /v1/leaderboards/:id/stats
 * @description Get leaderboard statistics
 * @param {string} id - Leaderboard ID
 */
router.get(
  '/:id/stats',
  asyncHandler(async (req, res) => {
    const { tenantId, projectId } = req.tenant;
    const { id } = req.params;

    // Verify leaderboard exists
    const leaderboard = await leaderboardService.getById(tenantId, projectId, id);
    if (!leaderboard) {
      throw errors.notFound('Leaderboard');
    }

    const stats = await leaderboardService.getStats({
      tenantId,
      projectId,
      leaderboardId: id,
    });

    res.json({
      success: true,
      data: {
        leaderboard: {
          id: leaderboard.id,
          name: leaderboard.name,
        },
        stats,
      },
    });
  })
);

export default router;
