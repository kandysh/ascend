/**
 * @fileoverview API key authentication middleware
 * @module middleware/auth
 */

import crypto from 'crypto';
import db from '../db/postgres.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

/**
 * @typedef {Object} TenantContext
 * @property {string} tenantId - Tenant ID
 * @property {string} projectId - Project ID
 * @property {string} plan - Tenant's subscription plan
 * @property {string} apiKeyId - API key ID
 * @property {string} apiKeyName - API key name
 */

/**
 * @typedef {import('express').Request & { tenant: TenantContext, log: import('pino').Logger }} AuthenticatedRequest
 */

/**
 * Hash an API key for comparison
 * @param {string} apiKey - Plain text API key
 * @returns {string} SHA-256 hash of the API key
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * API key authentication middleware
 * Extracts API key from header, validates it, and attaches tenant context to request
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
export async function authenticate(req, res, next) {
  const apiKey = req.get(config.apiKeyHeader);

  if (!apiKey) {
    logger.warn({ path: req.path, method: req.method }, 'Missing API key');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Provide it in the X-Api-Key header.',
    });
  }

  // Validate API key format (basic check)
  if (apiKey.length < 20) {
    logger.warn({ path: req.path }, 'Invalid API key format');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format.',
    });
  }

  try {
    const keyHash = hashApiKey(apiKey);

    // Query for API key and join with tenant and project info
    const result = await db.query(
      `SELECT
        ak.id AS api_key_id,
        ak.name AS api_key_name,
        ak.tenant_id,
        ak.project_id,
        ak.is_active,
        ak.expires_at,
        t.plan,
        t.name AS tenant_name,
        p.name AS project_name
      FROM api_keys ak
      JOIN tenants t ON ak.tenant_id = t.id
      JOIN projects p ON ak.project_id = p.id
      WHERE ak.key_hash = $1`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      logger.warn(
        { path: req.path, keyPrefix: apiKey.substring(0, 12) },
        'API key not found'
      );
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key.',
      });
    }

    const keyData = result.rows[0];

    // Check if key is active
    if (!keyData.is_active) {
      logger.warn(
        { apiKeyId: keyData.api_key_id, tenantId: keyData.tenant_id },
        'Inactive API key used'
      );
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is inactive.',
      });
    }

    // Check if key has expired
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      logger.warn(
        { apiKeyId: keyData.api_key_id, expiresAt: keyData.expires_at },
        'Expired API key used'
      );
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key has expired.',
      });
    }

    // Attach tenant context to request
    /** @type {TenantContext} */
    const tenantContext = {
      tenantId: keyData.tenant_id,
      projectId: keyData.project_id,
      plan: keyData.plan,
      apiKeyId: keyData.api_key_id,
      apiKeyName: keyData.api_key_name,
      tenantName: keyData.tenant_name,
      projectName: keyData.project_name,
    };

    req.tenant = tenantContext;

    // Create child logger with tenant context
    req.log = logger.child({
      tenantId: tenantContext.tenantId,
      projectId: tenantContext.projectId,
      apiKeyId: tenantContext.apiKeyId,
    });

    // Update last_used_at asynchronously (don't wait for it)
    db.query(
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [keyData.api_key_id]
    ).catch((err) => {
      logger.error({ err, apiKeyId: keyData.api_key_id }, 'Failed to update API key last_used_at');
    });

    next();
  } catch (err) {
    logger.error({ err }, 'Authentication error');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during authentication.',
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches tenant context if API key is provided, but doesn't require it
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
export async function optionalAuth(req, res, next) {
  const apiKey = req.get(config.apiKeyHeader);

  if (!apiKey) {
    req.tenant = null;
    req.log = logger;
    return next();
  }

  // If API key is provided, validate it
  return authenticate(req, res, next);
}

/**
 * Middleware to require a specific plan or higher
 * @param {string[]} allowedPlans - Array of allowed plan names
 * @returns {import('express').RequestHandler} Express middleware
 */
export function requirePlan(allowedPlans) {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    if (!allowedPlans.includes(req.tenant.plan)) {
      logger.warn(
        {
          tenantId: req.tenant.tenantId,
          plan: req.tenant.plan,
          requiredPlans: allowedPlans,
        },
        'Plan restriction violated'
      );
      return res.status(403).json({
        error: 'Forbidden',
        message: `This feature requires one of the following plans: ${allowedPlans.join(', ')}.`,
      });
    }

    next();
  };
}

export default {
  authenticate,
  optionalAuth,
  requirePlan,
};
