/**
 * @fileoverview PostgreSQL client with connection pool
 * @module db/postgres
 */

import pg from 'pg';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

/**
 * PostgreSQL connection pool instance
 * @type {pg.Pool}
 */
const pool = new Pool({
  connectionString: config.postgres.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log pool events
pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

pool.on('remove', () => {
  logger.debug('PostgreSQL client removed from pool');
});

/**
 * Execute a query on the PostgreSQL database
 * @param {string} text - SQL query text
 * @param {Array} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>} Query result
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({
      query: text,
      duration,
      rows: result.rowCount,
    }, 'Executed PostgreSQL query');
    return result;
  } catch (err) {
    logger.error({ err, query: text }, 'PostgreSQL query error');
    throw err;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<pg.PoolClient>} Pool client
 */
export async function getClient() {
  const client = await pool.query();
  return client;
}

/**
 * Execute a transaction with automatic commit/rollback
 * @template T
 * @param {(client: pg.PoolClient) => Promise<T>} callback - Transaction callback
 * @returns {Promise<T>} Transaction result
 */
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check database connectivity
 * @returns {Promise<boolean>} True if connected
 */
export async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    logger.error({ err }, 'PostgreSQL health check failed');
    return false;
  }
}

/**
 * Close all pool connections
 * @returns {Promise<void>}
 */
export async function close() {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}

export default {
  query,
  getClient,
  transaction,
  healthCheck,
  close,
  pool,
};
