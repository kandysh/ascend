/**
 * @fileoverview Global error handler middleware
 * @module middleware/errorHandler
 */

import logger from '../utils/logger.js';

/**
 * Custom application error class
 */
export class AppError extends Error {
  /**
   * Create an application error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} [code] - Error code for client identification
   * @param {Object} [details] - Additional error details
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error factory functions
 */
export const errors = {
  /**
   * Create a 400 Bad Request error
   * @param {string} message - Error message
   * @param {Object} [details] - Validation details
   * @returns {AppError}
   */
  badRequest(message = 'Bad Request', details = null) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  },

  /**
   * Create a 401 Unauthorized error
   * @param {string} message - Error message
   * @returns {AppError}
   */
  unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  },

  /**
   * Create a 403 Forbidden error
   * @param {string} message - Error message
   * @returns {AppError}
   */
  forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  },

  /**
   * Create a 404 Not Found error
   * @param {string} resource - Resource type that was not found
   * @returns {AppError}
   */
  notFound(resource = 'Resource') {
    return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
  },

  /**
   * Create a 409 Conflict error
   * @param {string} message - Error message
   * @returns {AppError}
   */
  conflict(message = 'Resource already exists') {
    return new AppError(message, 409, 'CONFLICT');
  },

  /**
   * Create a 422 Unprocessable Entity error
   * @param {string} message - Error message
   * @param {Object} [details] - Validation details
   * @returns {AppError}
   */
  unprocessable(message = 'Unprocessable Entity', details = null) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  },

  /**
   * Create a 429 Too Many Requests error
   * @param {string} message - Error message
   * @param {Object} [details] - Rate limit details
   * @returns {AppError}
   */
  rateLimited(message = 'Too many requests', details = null) {
    return new AppError(message, 429, 'RATE_LIMITED', details);
  },

  /**
   * Create a 500 Internal Server Error
   * @param {string} message - Error message
   * @returns {AppError}
   */
  internal(message = 'Internal Server Error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  },

  /**
   * Create a 503 Service Unavailable error
   * @param {string} message - Error message
   * @returns {AppError}
   */
  serviceUnavailable(message = 'Service temporarily unavailable') {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  },
};

/**
 * Handle 404 Not Found for unknown routes
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function notFoundHandler(req, res, next) {
  next(errors.notFound(`Route ${req.method} ${req.path}`));
}

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} _next - Express next function
 */
export function errorHandler(err, req, res, _next) {
  // Default values
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'SyntaxError' && err.status === 400) {
    // JSON parsing error
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON payload';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'Database connection failed';
  }

  // Log the error
  const logContext = {
    err: {
      message: err.message,
      stack: err.stack,
      code: err.code,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type'),
      },
      query: req.query,
      body: req.body,
    },
    tenantId: req.tenant?.id,
    projectId: req.project?.id,
    requestId: req.id,
  };

  // Log at appropriate level based on status code
  if (statusCode >= 500) {
    logger.error(logContext, `Server error: ${message}`);
  } else if (statusCode >= 400) {
    logger.warn(logContext, `Client error: ${message}`);
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'An unexpected error occurred';
    details = null;
  }

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV !== 'production' && {
        stack: err.stack?.split('\n').slice(0, 5),
      }),
    },
    timestamp: new Date().toISOString(),
    requestId: req.id,
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Async handler wrapper to catch promise rejections
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped route handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default errorHandler;
