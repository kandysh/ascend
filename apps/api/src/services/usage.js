/**
 * @fileoverview Usage service for tracking and reporting API usage
 * @module services/usage
 */

import { getClient } from '../db/redis.js';
import db from '../db/postgres.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

/**
 * @typedef {Object} UsageStats
 * @property {number} operationCount - Total operations this month
 * @property {number} readCount - Read operations this month
 * @property {number} writeCount - Write operations this month
 * @property {number} limit - Monthly operation limit
 * @property {number} remaining - Remaining operations
 * @property {string} plan - Current plan
 * @property {string} period - Usage period (YYYY-MM)
 * @property {number} percentUsed - Percentage of limit used
 */

/**
 * @typedef {Object} UsageHistory
 * @property {string} month - Month (YYYY-MM)
 * @property {number} operationCount - Total operations
 * @property {number} readCount - Read operations
 * @property {number} writeCount - Write operations
 */

/**
 * Usage service class for tracking API usage
 */
class UsageService {
  /**
   * Get current month's usage for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} plan - Tenant's plan
   * @returns {Promise<UsageStats>}
   */
  async getCurrentUsage(tenantId, plan) {
    const redis = getClient();
    const now = new Date();
    const month = this._getCurrentMonth();
    const limit = config.plans[plan] || config.plans.free;

    // Get usage from Redis (real-time counter)
    const usageKey = `usage:${tenantId}:${month}`;
    const readKey = `usage:${tenantId}:${month}:reads`;
    const writeKey = `usage:${tenantId}:${month}:writes`;

    const pipeline = redis.pipeline();
    pipeline.get(usageKey);
    pipeline.get(readKey);
    pipeline.get(writeKey);

    const results = await pipeline.exec();

    const operationCount = parseInt(results[0][1] || '0', 10);
    const readCount = parseInt(results[1][1] || '0', 10);
    const writeCount = parseInt(results[2][1] || '0', 10);
    const remaining = Math.max(0, limit - operationCount);
    const percentUsed = limit === Infinity ? 0 : Math.round((operationCount / limit) * 100);

    return {
      operationCount,
      readCount,
      writeCount,
      limit: limit === Infinity ? -1 : limit,
      remaining: limit === Infinity ? -1 : remaining,
      plan,
      period: month,
      percentUsed,
      resetDate: this._getNextResetDate(),
    };
  }

  /**
   * Get usage history for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {number} [months=6] - Number of months to retrieve
   * @returns {Promise<UsageHistory[]>}
   */
  async getUsageHistory(tenantId, months = 6) {
    const result = await db.query(
      `SELECT
        month,
        operation_count as "operationCount",
        read_count as "readCount",
        write_count as "writeCount"
       FROM usage
       WHERE tenant_id = $1
       ORDER BY month DESC
       LIMIT $2`,
      [tenantId, months]
    );

    return result.rows;
  }

  /**
   * Increment operation counter
   * @param {string} tenantId - Tenant ID
   * @param {'read' | 'write'} operationType - Type of operation
   * @param {number} [count=1] - Number of operations
   * @returns {Promise<number>} New total count
   */
  async incrementUsage(tenantId, operationType = 'read', count = 1) {
    const redis = getClient();
    const month = this._getCurrentMonth();
    const usageKey = `usage:${tenantId}:${month}`;
    const typeKey = `usage:${tenantId}:${month}:${operationType}s`;

    // Set expiry to 62 days (covers month rollover)
    const expiry = 60 * 60 * 24 * 62;

    const pipeline = redis.pipeline();
    pipeline.incrby(usageKey, count);
    pipeline.expire(usageKey, expiry);
    pipeline.incrby(typeKey, count);
    pipeline.expire(typeKey, expiry);

    const results = await pipeline.exec();
    return results[0][1];
  }

  /**
   * Sync Redis usage counters to PostgreSQL
   * Should be called periodically (e.g., every hour via cron)
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<void>}
   */
  async syncToDatabase(tenantId) {
    const redis = getClient();
    const month = this._getCurrentMonth();

    const usageKey = `usage:${tenantId}:${month}`;
    const readKey = `usage:${tenantId}:${month}:reads`;
    const writeKey = `usage:${tenantId}:${month}:writes`;

    const pipeline = redis.pipeline();
    pipeline.get(usageKey);
    pipeline.get(readKey);
    pipeline.get(writeKey);

    const results = await pipeline.exec();

    const operationCount = parseInt(results[0][1] || '0', 10);
    const readCount = parseInt(results[1][1] || '0', 10);
    const writeCount = parseInt(results[2][1] || '0', 10);

    await db.query(
      `INSERT INTO usage (tenant_id, month, operation_count, read_count, write_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, month)
       DO UPDATE SET
         operation_count = $3,
         read_count = $4,
         write_count = $5,
         updated_at = CURRENT_TIMESTAMP`,
      [tenantId, month, operationCount, readCount, writeCount]
    );

    logger.debug(
      { tenantId, month, operationCount, readCount, writeCount },
      'Usage synced to database'
    );
  }

  /**
   * Sync all tenants' usage to database
   * @returns {Promise<number>} Number of tenants synced
   */
  async syncAllToDatabase() {
    const result = await db.query('SELECT id FROM tenants');
    const tenantIds = result.rows.map((row) => row.id);

    let syncedCount = 0;
    for (const tenantId of tenantIds) {
      try {
        await this.syncToDatabase(tenantId);
        syncedCount++;
      } catch (err) {
        logger.error({ err, tenantId }, 'Failed to sync usage for tenant');
      }
    }

    logger.info({ syncedCount, totalTenants: tenantIds.length }, 'Usage sync completed');
    return syncedCount;
  }

  /**
   * Check if tenant has exceeded their usage limit
   * @param {string} tenantId - Tenant ID
   * @param {string} plan - Tenant's plan
   * @returns {Promise<{exceeded: boolean, current: number, limit: number}>}
   */
  async checkLimit(tenantId, plan) {
    const redis = getClient();
    const month = this._getCurrentMonth();
    const usageKey = `usage:${tenantId}:${month}`;
    const limit = config.plans[plan] || config.plans.free;

    const current = parseInt((await redis.get(usageKey)) || '0', 10);
    const exceeded = limit !== Infinity && current >= limit;

    return {
      exceeded,
      current,
      limit: limit === Infinity ? -1 : limit,
    };
  }

  /**
   * Get usage breakdown by leaderboard for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} [month] - Month to query (defaults to current)
   * @returns {Promise<Array<{leaderboardId: string, leaderboardName: string, count: number}>>}
   */
  async getUsageByLeaderboard(tenantId, month = null) {
    const targetMonth = month || this._getCurrentMonth();
    const startDate = new Date(`${targetMonth}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const result = await db.query(
      `SELECT
        se.leaderboard_id as "leaderboardId",
        l.name as "leaderboardName",
        COUNT(*) as count
       FROM score_events se
       JOIN leaderboards l ON se.leaderboard_id = l.id
       WHERE se.tenant_id = $1
         AND se.created_at >= $2
         AND se.created_at < $3
       GROUP BY se.leaderboard_id, l.name
       ORDER BY count DESC`,
      [tenantId, startDate.toISOString(), endDate.toISOString()]
    );

    return result.rows.map((row) => ({
      ...row,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Get daily usage for the current month
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array<{date: string, count: number}>>}
   */
  async getDailyUsage(tenantId) {
    const month = this._getCurrentMonth();
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const result = await db.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as count
       FROM score_events
       WHERE tenant_id = $1
         AND created_at >= $2
         AND created_at < $3
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [tenantId, startDate.toISOString(), endDate.toISOString()]
    );

    return result.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Reset usage counters (for testing or manual reset)
   * @param {string} tenantId - Tenant ID
   * @param {string} [month] - Month to reset (defaults to current)
   * @returns {Promise<void>}
   */
  async resetUsage(tenantId, month = null) {
    const redis = getClient();
    const targetMonth = month || this._getCurrentMonth();

    const usageKey = `usage:${tenantId}:${targetMonth}`;
    const readKey = `usage:${tenantId}:${targetMonth}:reads`;
    const writeKey = `usage:${tenantId}:${targetMonth}:writes`;

    await redis.del(usageKey, readKey, writeKey);

    logger.info({ tenantId, month: targetMonth }, 'Usage counters reset');
  }

  /**
   * Get the current month string
   * @private
   * @returns {string} Month in YYYY-MM format
   */
  _getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get the next usage reset date
   * @private
   * @returns {string} ISO date string of next reset
   */
  _getNextResetDate() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
  }
}

// Export singleton instance
const usageService = new UsageService();
export default usageService;
