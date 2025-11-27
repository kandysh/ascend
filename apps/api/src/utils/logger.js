/**
 * @fileoverview Pino logger utility with structured logging and trace ID support
 * @module utils/logger
 */

import pino from 'pino';
import { trace, context } from '@opentelemetry/api';
import config from '../config/index.js';

/**
 * Custom log formatter that adds trace context to log entries
 * @returns {Object} Pino formatters configuration
 */
const formatters = {
  /**
   * Format log level to include level name
   * @param {string} label - Log level label
   * @param {number} number - Log level number
   * @returns {Object} Formatted level object
   */
  level(label, number) {
    return { level: label, levelNum: number };
  },

  /**
   * Add trace context to log bindings
   * @param {Object} bindings - Log bindings
   * @returns {Object} Bindings with trace context
   */
  bindings(bindings) {
    return {
      pid: bindings.pid,
      host: bindings.hostname,
      service: config.otel.serviceName,
    };
  },

  /**
   * Add trace and span IDs to each log entry
   * @param {Object} obj - Log object
   * @returns {Object} Log object with trace context
   */
  log(obj) {
    const span = trace.getSpan(context.active());
    if (span) {
      const spanContext = span.spanContext();
      return {
        ...obj,
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
    return obj;
  },
};

/**
 * Pino logger instance configured for production use
 * @type {import('pino').Logger}
 */
const logger = pino({
  level: config.logLevel,
  formatters,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: config.nodeEnv,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-api-key"]', 'apiKey'],
    censor: '[REDACTED]',
  },
  ...(config.nodeEnv === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

/**
 * Create a child logger with additional context
 * @param {Object} bindings - Additional context to bind to logs
 * @returns {import('pino').Logger} Child logger instance
 */
export function createChildLogger(bindings) {
  return logger.child(bindings);
}

/**
 * Create a logger with tenant context
 * @param {Object} tenant - Tenant information
 * @param {string} tenant.tenantId - Tenant ID
 * @param {string} tenant.projectId - Project ID
 * @returns {import('pino').Logger} Child logger with tenant context
 */
export function createTenantLogger(tenant) {
  return logger.child({
    tenantId: tenant.tenantId,
    projectId: tenant.projectId,
  });
}

/**
 * Create a logger for a specific request
 * @param {string} requestId - Request ID
 * @param {Object} [additionalContext] - Additional context to bind
 * @returns {import('pino').Logger} Child logger with request context
 */
export function createRequestLogger(requestId, additionalContext = {}) {
  return logger.child({
    requestId,
    ...additionalContext,
  });
}

export default logger;
