const logger = require('../utils/logger');
const { logSecurityEvent, AUDIT_EVENTS } = require('../utils/auditLogger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle Mongoose validation errors
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(e => e.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle Mongoose duplicate key errors
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const message = `Duplicate field value: ${field}. Please use another value.`;
  return new AppError(message, 400);
};

// Handle Mongoose cast errors
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Handle JWT errors
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

// Send error in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

// Send error in production
const sendErrorProd = (err, res, req) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    // Sanitize error message to prevent information leakage
    const sanitizedMessage = sanitizeErrorMessage(err.message, err.statusCode);
    
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: sanitizedMessage
    });
  } else {
    // Programming or unknown error: don't leak error details
    logger.error('ERROR 💥', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });
    
    // Log security event for suspicious errors
    if (err.statusCode === 403 || err.statusCode === 401) {
      logSecurityEvent(AUDIT_EVENTS.UNAUTHORIZED_ATTEMPT, {
        severity: 'high',
        error: err.message,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id
      });
    }
    
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'An error occurred. Please try again later.'
    });
  }
};

/**
 * Sanitize error messages to prevent information leakage
 * @param {string} message - Original error message
 * @param {number} statusCode - HTTP status code
 * @returns {string} - Sanitized message
 */
const sanitizeErrorMessage = (message, statusCode) => {
  // List of patterns that might leak sensitive information
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /mongodb/i,
    /redis/i,
    /database/i,
    /connection string/i,
    /internal server/i
  ];

  // Check if message contains sensitive information
  const containsSensitiveInfo = sensitivePatterns.some(pattern => 
    pattern.test(message)
  );

  if (containsSensitiveInfo) {
    // Return generic message based on status code
    if (statusCode >= 400 && statusCode < 500) {
      return 'Invalid request. Please check your input.';
    }
    return 'An error occurred. Please try again later.';
  }

  // Limit message length to prevent verbose error messages
  if (message.length > 200) {
    return message.substring(0, 200) + '...';
  }

  return message;
};

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error with context
  logger.error('Error occurred:', {
    message: err.message,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.name === 'ValidationError') error = handleValidationError(err);
    if (err.code === 11000) error = handleDuplicateKeyError(err);
    if (err.name === 'CastError') error = handleCastError(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res, req);
  }
};

// Async handler wrapper to catch errors in async functions
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { AppError, errorHandler, asyncHandler };
