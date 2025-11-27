/**
 * @fileoverview Leaderboard service with Redis ZSET operations
 * @module services/leaderboard
 */

import { getClient, getLeaderboardKey } from '../db/redis.js';
import db from '../db/postgres.js';
import logger from '../utils/logger.js';
import { incrementUsage } from '../middleware/rateLimiter.js';

/**
 * @typedef {Object} ScoreEntry
 * @property {string} userId - User ID
 * @property {number} score - User's score
 * @property {number} rank - User's rank (1-based)
 */

/**
 * @typedef {Object} LeaderboardConfig
 * @property {string} id - Leaderboard ID
 * @property {string} name - Leaderboard name
 * @property {string} description - Leaderboard description
 * @property {'asc' | 'desc'} sortOrder - Sort order (desc = highest first)
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} UpdateScoreResult
 * @property {string} userId - User ID
 * @property {number} score - New score
 * @property {number} previousScore - Previous score (0 if new user)
 * @property {number} rank - New rank
 * @property {number} delta - Score change
 */

/**
 * Leaderboard service class
 */
class LeaderboardService {
  /**
   * Create a new leaderboard
   * @param {Object} params - Leaderboard parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.projectId - Project ID
   * @param {string} params.name - Leaderboard name
   * @param {string} [params.description] - Leaderboard description
   * @param {'asc' | 'desc'} [params.sortOrder='desc'] - Sort order
   * @param {Object} [params.metadata={}] - Additional metadata
   * @returns {Promise<LeaderboardConfig>} Created leaderboard
   */
  async create({
    tenantId,
    projectId,
    name,
    description = '',
    sortOrder = 'desc',
    metadata = {},
  }) {
    const result = await db.query(
      `INSERT INTO leaderboards (tenant_id, project_id, name, description, sort_order, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, sort_order as "sortOrder", metadata, created_at as "createdAt"`,
      [tenantId, projectId, name, description, sortOrder, JSON.stringify(metadata)]
    );

    logger.info(
      { tenantId, projectId, leaderboardId: result.rows[0].id, name },
      'Leaderboard created'
    );

    return result.rows[0];
  }

  /**
   * Get a leaderboard by ID
   * @param {string} tenantId - Tenant ID
   * @param {string} projectId - Project ID
   * @param {string} leaderboardId - Leaderboard ID
   * @returns {Promise<LeaderboardConfig | null>} Leaderboard or null if not found
   */
  async getById(tenantId, projectId, leaderboardId) {
    const result = await db.query(
      `SELECT id, name, description, sort_order as "sortOrder", metadata, created_at as "createdAt"
       FROM leaderboards
       WHERE id = $1 AND tenant_id = $2 AND project_id = $3`,
      [leaderboardId, tenantId, projectId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get a leaderboard by name
   * @param {string} tenantId - Tenant ID
   * @param {string} projectId - Project ID
   * @param {string} name - Leaderboard name
   * @returns {Promise<LeaderboardConfig | null>} Leaderboard or null if not found
   */
  async getByName(tenantId, projectId, name) {
    const result = await db.query(
      `SELECT id, name, description, sort_order as "sortOrder", metadata, created_at as "createdAt"
       FROM leaderboards
       WHERE name = $1 AND tenant_id = $2 AND project_id = $3`,
      [name, tenantId, projectId]
    );

    return result.rows[0] || null;
  }

  /**
   * List all leaderboards for a project
   * @param {string} tenantId - Tenant ID
   * @param {string} projectId - Project ID
   * @param {Object} [options] - List options
   * @param {number} [options.limit=50] - Maximum number of results
   * @param {number} [options.offset=0] - Offset for pagination
   * @returns {Promise<{leaderboards: LeaderboardConfig[], total: number}>}
   */
  async list(tenantId, projectId, { limit = 50, offset = 0 } = {}) {
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM leaderboards WHERE tenant_id = $1 AND project_id = $2',
      [tenantId, projectId]
    );

    const result = await db.query(
      `SELECT id, name, description, sort_order as "sortOrder", metadata, created_at as "createdAt"
       FROM leaderboards
       WHERE tenant_id = $1 AND project_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [tenantId, projectId, limit, offset]
    );

    return {
      leaderboards: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Delete a leaderboard
   * @param {string} tenantId - Tenant ID
   * @param {string} projectId - Project ID
   * @param {string} leaderboardId - Leaderboard ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(tenantId, projectId, leaderboardId) {
    const redis = getClient();
    const redisKey = getLeaderboardKey(tenantId, projectId, leaderboardId);

    // Delete from Redis first
    await redis.del(redisKey);

    // Delete from PostgreSQL (cascades to score_events)
    const result = await db.query(
      'DELETE FROM leaderboards WHERE id = $1 AND tenant_id = $2 AND project_id = $3 RETURNING id',
      [leaderboardId, tenantId, projectId]
    );

    if (result.rowCount > 0) {
      logger.info({ tenantId, projectId, leaderboardId }, 'Leaderboard deleted');
      return true;
    }

    return false;
  }

  /**
   * Update a user's score (set absolute value)
   * @param {Object} params - Score update parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.projectId - Project ID
   * @param {string} params.leaderboardId - Leaderboard ID
   * @param {string} params.userId - User ID
   * @param {number} params.score - New score value
   * @param {Object} [params.metadata={}] - Score event metadata
   * @returns {Promise<UpdateScoreResult>} Update result
   */
  async setScore({
    tenantId,
    projectId,
    leaderboardId,
    userId,
    score,
    metadata = {},
  }) {
    const redis = getClient();
    const redisKey = getLeaderboardKey(tenantId, projectId, leaderboardId);

    // Get previous score
    const previousScore = await redis.zscore(redisKey, userId);
    const prevScoreNum = previousScore ? parseFloat(previousScore) : 0;
    const delta = score - prevScoreNum;

    // Set the new score
    await redis.zadd(redisKey, score, userId);

    // Get new rank (ZREVRANK for descending order, 0-based)
    const rank = await redis.zrevrank(redisKey, userId);

    // Record score event asynchronously
    this._recordScoreEvent({
      tenantId,
      projectId,
      leaderboardId,
      userId,
      score,
      delta,
      metadata,
    }).catch((err) => {
      logger.error({ err, tenantId, leaderboardId, userId }, 'Failed to record score event');
    });

    // Increment usage counter
    incrementUsage(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'Failed to increment usage');
    });

    return {
      userId,
      score,
      previousScore: prevScoreNum,
      rank: rank + 1, // Convert to 1-based
      delta,
    };
  }

  /**
   * Increment a user's score by a delta
   * @param {Object} params - Score increment parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.projectId - Project ID
   * @param {string} params.leaderboardId - Leaderboard ID
   * @param {string} params.userId - User ID
   * @param {number} params.delta - Score delta (can be negative)
   * @param {Object} [params.metadata={}] - Score event metadata
   * @returns {Promise<UpdateScoreResult>} Update result
   */
  async incrementScore({
    tenantId,
    projectId,
    leaderboardId,
    userId,
    delta,
    metadata = {},
  }) {
    const redis = getClient();
    const redisKey = getLeaderboardKey(tenantId, projectId, leaderboardId);

    // Get previous score
    const previousScore = await redis.zscore(redisKey, userId);
    const prevScoreNum = previousScore ? parseFloat(previousScore) : 0;

    // Increment the score atomically
    const newScore = await redis.zincrby(redisKey, delta, userId);
    const score = parseFloat(newScore);

    // Get new rank
    const rank = await redis.zrevrank(redisKey, userId);

    // Record score event asynchronously
    this._recordScoreEvent({
      tenantId,
      projectId,
      leaderboardId,
      userId,
      score,
      delta,
      metadata,
    }).catch((err) => {
      logger.error({ err, tenantId, leaderboardId, userId }, 'Failed to record score event');
    });

    // Increment usage counter
    incrementUsage(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'Failed to increment usage');
    });

    return {
      userId,
      score,
      previousScore: prevScoreNum,
      rank: rank + 1,
      delta,
    };
  }

  /**
   * Get top scores from leaderboard
   * @param {Object} params - Query parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.projectId - Project ID
   * @param {string} params.leaderboardId - Leaderboard ID
   * @param {number} [params.limit=10] - Number of entries to return
   * @param {number} [params.offset=0] - Offset for pagination
   * @param {'asc' | 'desc'} [params.order='desc'] - Sort order
   * @returns {Promise<{entries: ScoreEntry[], total: number}>}
   */
  async getTopScores({
    tenantId,
    projectId,
    leaderboardId,
    limit = 10,
    offset = 0,
    order = 'desc',
  }) {
    const redis = getClient();
    const redisKey = getLeaderboardKey(tenantId, projectId, leaderboardId);

    // Get total count
    const total = await redis.zcard(redisKey);

    // Get entries with scores
    let entries;
    if (order === 'desc') {
      entries = await redis.zrevrange(redisKey, offset, offset + limit - 1, 'WITHSCORES');
    } else {
      entries = await redis.zrange(redisKey, offset, offset + limit - 1, 'WITHSCORES');
    }

    // Parse results (alternating userId, score)
    /** @type {ScoreEntry[]} */
    const results = [];
    for (let i = 0; i < entries.length; i += 2) {
      results.push({
        userId: entries[i],
        score: parseFloat(entries[i + 1]),
        rank: offset + Math.floor(i / 2) + 1,
      });
    }

    // Increment usage counter for read operation
    incrementUsage(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'Failed to increment usage');
    });

    return {
      entries: results,
      total,
    };
  }

  /**
   * Get a specific user's rank and score
   * @param {Object} params - Query parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.projectId - Project ID
   * @param {string} params.leaderboardId - Leaderboard ID
   * @param {string} params.userId - User ID
   * @param {'asc' | 'desc'} [params.order='desc'] - Sort order
   * @returns {Promise<ScoreEntry | null>} User's entry or null if not found
   */
  async getUserRank({
    tenantId,
    projectId,
    leaderboardId,
    userId,
    order = 'desc',
  }) {
    const redis = getClient();
    const redisKey = getLeaderboardKey(tenantId, projectId, leaderboardId);

    // Get score
    const score = await redis.zscore(redisKey, userId);
    if (score === null) {
      return null;
    }

    // Get rank based on sort order
    let rank;
    if (order === 'desc') {
      rank = await redis.zrevrank(redisKey, userId);
    } else {
      rank = await redis.zrank(redisKey, userId);
    }

    // Increment usage counter
    incrementUsage(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'Failed to increment usage');
    });

    return {
      userId,
      score: parseFloat(score),
      rank: rank + 1, // Convert to 1-based
    };
  }

  /**
   * Get multiple users' ranks and scores
   * @param {Object} params - Query parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.projectId - Project ID
   * @param {string} params.leaderboardId - Leaderboard ID
   * @param {string[]} params.userIds - Array of user IDs
   * @param {'asc' | 'desc'} [params.order='desc'] - Sort order
   * @returns {Promise<ScoreEntry[]>} Array of user entries (only found users)
   */
  async getUsersRanks({
    tenantId,
    projectId,
    leaderboardId,
    userIds,
    order = 'desc',
  }) {
    const redis = getClient();
    const redisKey = getLeaderboardKey(tenantId, projectId, leaderboardId);

    // Get scores for all users
    const scores = await redis.zmscore(redisKey, ...userIds);

    // Get ranks and build results
    const results = [];
    const pipeline = redis.pipeline();

    userIds.forEach((userId, index) => {
      if (scores[index] !== null) {
        if (order === 'desc') {
          pipeline.zrevrank(redisKey, userId);
        } else {
          pipeline.zrank(redisKey, userId);
        }
      }
    });

    const ranks = await pipeline.exec();
    let rankIndex = 0;

    userIds.forEach((userId, index) => {
      if (scores[index] !== null) {
        results.push({
          userId,
          score: parseFloat(scores[index]),
          rank: ranks[rankIndex][1] + 1,
        });
        rankIndex++;
      }
    });

    // Increment usage counter
    incrementUsage(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'Failed to increment usage');
    });

    return results;
  }

  /**
   * Get users around a specific user's rank
   * @param {Object} params - Query parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.projectId - Project ID
   * @param {string} params.leaderboardId - Leaderboard ID
   * @param {string} params.userId - Center user ID
   * @param {number} [params.range=5] - Number of entries above and below
   * @param {'asc' | 'desc'} [params.order='desc'] - Sort order
   * @returns {Promise<{entries: ScoreEntry[], userRank: number | null}>}
   */
  async getAroundUser({
    tenantId,
    projectId,
    leaderboardId,
    userId,
    range = 5,
    order = 'desc',
  }) {
    const redis = getClient();
    const redisKey = getLeaderboardKey(tenantId, projectId, leaderboardId);

    // Get user's rank
    let userRank;
    if (order === 'desc') {
      userRank = await redis.zrevrank(redisKey, userId);
    } else {
      userRank = await redis.zrank(redisKey, userId);
    }

    if (userRank === null) {
      return {
        entries: [],
        userRank: null,
      };
    }

    // Calculate range
    const start = Math.max(0, userRank - range);
    const end = userRank + range;

    // Get entries in range
    let entries;
    if (order === 'desc') {
      entries = await redis.zrevrange(redisKey, start, end, 'WITHSCORES');
    } else {
      entries = await redis.zrange(redisKey, start, end, 'WITHSCORES');
    }

    // Parse results
    const results = [];
    for (let i = 0; i < entries.length; i += 2) {
      results.push({
        userId: entries[i],
        score: parseFloat(entries[i + 1]),
        rank: start + Math.floor(i / 2) + 1,
      });
    }

    // Increment usage counter
    incrementUsage(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'Failed to increment usage');
    });

    return {
      entries: results,
      userRank: userRank + 1,
    };
  }

  /**
   * Remove a user from the leaderboard
   * @param {Object} params - Parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.projectId - Project ID
   * @param {string} params.leaderboardId - Leaderboard ID
   * @param {string} params.userId - User ID to remove
   * @returns {Promise<boolean>} True if user was removed
   */
  async removeUser({ tenantId, projectId, leaderboardId, userId }) {
    const redis = getClient();
    const redisKey = getLeaderboardKey(tenantId, projectId, leaderboardId);

    const removed = await redis.zrem(redisKey, userId);

    if (removed > 0) {
      logger.info(
        { tenantId, projectId, leaderboardId, userId },
        'User removed from leaderboard'
      );
      return true;
    }

    return false;
  }

  /**
   * Get leaderboard statistics
   * @param {Object} params - Parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.projectId - Project ID
   * @param {string} params.leaderboardId - Leaderboard ID
   * @returns {Promise<{count: number, minScore: number | null, maxScore: number | null}>}
   */
  async getStats({ tenantId, projectId, leaderboardId }) {
    const redis = getClient();
    const redisKey = getLeaderboardKey(tenantId, projectId, leaderboardId);

    const pipeline = redis.pipeline();
    pipeline.zcard(redisKey);
    pipeline.zrange(redisKey, 0, 0, 'WITHSCORES'); // Min score
    pipeline.zrevrange(redisKey, 0, 0, 'WITHSCORES'); // Max score

    const results = await pipeline.exec();

    const count = results[0][1];
    const minEntry = results[1][1];
    const maxEntry = results[2][1];

    return {
      count,
      minScore: minEntry.length > 0 ? parseFloat(minEntry[1]) : null,
      maxScore: maxEntry.length > 0 ? parseFloat(maxEntry[1]) : null,
    };
  }

  /**
   * Record a score event in PostgreSQL (for analytics)
   * @private
   * @param {Object} event - Score event
   */
  async _recordScoreEvent({ tenantId, projectId, leaderboardId, userId, score, delta, metadata }) {
    await db.query(
      `INSERT INTO score_events (tenant_id, project_id, leaderboard_id, user_id, score, delta, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, projectId, leaderboardId, userId, score, delta, JSON.stringify(metadata)]
    );
  }
}

// Export singleton instance
const leaderboardService = new LeaderboardService();
export default leaderboardService;
