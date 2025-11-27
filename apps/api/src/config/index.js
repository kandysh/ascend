/**
 * @fileoverview Application configuration loaded from environment variables
 * @module config
 */

/**
 * @typedef {Object} Config
 * @property {number} port - Server port
 * @property {string} nodeEnv - Node environment
 * @property {Object} redis - Redis configuration
 * @property {string} redis.url - Redis connection URL
 * @property {Object} postgres - PostgreSQL configuration
 * @property {string} postgres.url - PostgreSQL connection URL
 * @property {Object} otel - OpenTelemetry configuration
 * @property {string} otel.serviceName - Service name for OTEL
 * @property {string} otel.collectorUrl - OTEL collector URL
 * @property {Object} rateLimits - Rate limits per plan
 * @property {number} rateLimits.free - Free tier rate limit (req/s)
 * @property {number} rateLimits.hobby - Hobby tier rate limit (req/s)
 * @property {number} rateLimits.pro - Pro tier rate limit (req/s)
 * @property {number} rateLimits.enterprise - Enterprise tier rate limit (req/s)
 * @property {Object} plans - Plan operation limits per month
 * @property {number} plans.free - Free tier ops/month
 * @property {number} plans.hobby - Hobby tier ops/month
 * @property {number} plans.pro - Pro tier ops/month
 * @property {number} plans.enterprise - Enterprise tier ops/month (Infinity)
 */

/** @type {Config} */
const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  postgres: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/ascend",
  },

  otel: {
    serviceName: process.env.OTEL_SERVICE_NAME || "ascend-api",
    collectorUrl: process.env.OTEL_COLLECTOR_URL || "http://localhost:4318",
  },

  rateLimits: {
    free: 30,
    hobby: 100,
    pro: 300,
    enterprise: 1000,
  },

  plans: {
    free: 100_000,
    hobby: 2_000_000,
    pro: 20_000_000,
    enterprise: Infinity,
  },

  /**
   * API key header name
   * @type {string}
   */
  apiKeyHeader: "x-api-key",

  /**
   * Whether to trust proxy headers (for rate limiting)
   * @type {boolean}
   */
  trustProxy: process.env.TRUST_PROXY === "true",

  /**
   * Log level
   * @type {string}
   */
  logLevel: process.env.LOG_LEVEL || "info",
};

export default config;
