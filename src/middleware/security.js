const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const hpp = require('hpp');
const crypto = require('crypto');
const { logRateLimitExceeded } = require('../utils/auditLogger');
const logger = require('../utils/logger');
const { verifyToken } = require('../utils/jwt');

// Security headers with enhanced configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  // Strict Transport Security (HSTS)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  // Prevent MIME type sniffing
  noSniff: true,
  // Disable X-Powered-By header
  hidePoweredBy: true,
  // XSS Protection
  xssFilter: true,
  // Prevent clickjacking
  frameguard: {
    action: 'deny'
  },
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});

// Rate limiting with audit logging
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || 100),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitExceeded(req);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || 5), // Default: 5 attempts
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitExceeded(req);
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts',
      message: 'You have made too many login attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiting for multi-sig approval operations
const multiSigApprovalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 approval requests per hour
  message: 'Too many approval requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Use standard IP-based rate limiting
  skip: (req) => !req.user // Skip rate limiting if not authenticated
});

// Rate limiting for authenticated users - uses user ID from JWT as key
const authenticatedUserLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_USER_RATE_LIMIT_WINDOW || 15) * 60 * 1000, // Default: 15 minutes
  max: parseInt(process.env.AUTH_USER_RATE_LIMIT_MAX || 100), // Default: 100 requests per window
  message: 'Too many requests from this user, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID from JWT token as the rate limit key instead of IP address
  keyGenerator: (req) => {
    let token;
    
    // Extract token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // If no token, fall back to IP address using the proper helper for IPv6 support
    if (!token) {
      return ipKeyGenerator(req.ip);
    }
    
    try {
      // Verify and decode the JWT token
      const decoded = verifyToken(token);
      
      // If token is valid and contains user ID, use it as the key
      if (decoded && decoded.id) {
        return `user:${decoded.id}`;
      }
      
      // If token is invalid or doesn't contain ID, fall back to IP using the helper
      return ipKeyGenerator(req.ip);
    } catch (error) {
      // On error, fall back to IP address using the helper
      return ipKeyGenerator(req.ip);
    }
  },
  handler: (req, res) => {
    logRateLimitExceeded(req);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  // Skip rate limiting if not authenticated (optional - can be removed if you want to rate limit all requests)
  skip: (req) => {
    // Only apply rate limiting if there's a valid JWT token
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
      return true;
    }
    
    const token = req.headers.authorization.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      return !decoded || !decoded.id;
    } catch (error) {
      return true;
    }
  }
});

// MongoDB sanitization - prevent NoSQL injection (Express 5 compatible)
// Note: express-mongo-sanitize has compatibility issues with Express 5
// This custom middleware removes MongoDB operators from request data
const sanitizeData = (req, res, next) => {
  const removeMongoOperators = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    Object.keys(obj).forEach(key => {
      // Remove keys that start with $ (MongoDB operators)
      if (key.startsWith('$')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        removeMongoOperators(obj[key]);
      }
    });
    return obj;
  };

  // Sanitize body (mutable in Express 5)
  if (req.body) removeMongoOperators(req.body);
  
  // Note: req.query and req.params are immutable in Express 5
  // Query string sanitization is handled by validation layer
  
  next();
};

// XSS protection - custom middleware (Express 5 compatible)
// Note: xss-clean package is deprecated and not compatible with Express 5
// This custom middleware sanitizes HTML/JavaScript in request body only
// Query and params are immutable in Express 5, so we sanitize at validation layer
const xssClean = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // Remove basic XSS patterns
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeValue(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      }
    });
    return obj;
  };

  // Only sanitize body in Express 5 (query and params are immutable)
  if (req.body) sanitizeObject(req.body);
  
  next();
};

// Prevent HTTP parameter pollution
const preventParamPollution = hpp({
  whitelist: ['price', 'rating', 'stock'] // Allow duplicates for these params
});

/**
 * Verify webhook signature using HMAC-SHA256
 * Compares calculated signature with X-Webhook-Signature header
 * Uses timing-safe comparison to prevent timing attacks
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const verifyWebhookSignature = (req, res, next) => {
  try {
    // Get the webhook secret from environment variables
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('Webhook secret not configured');
      return res.status(500).json({
        success: false,
        error: 'Webhook verification not configured'
      });
    }

    // Get signature from header
    const signatureHeader = req.headers['x-webhook-signature'];
    
    if (!signatureHeader) {
      logger.warn('Webhook signature header missing', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Missing webhook signature'
      });
    }

    // Get raw request body
    // Note: req.body is already parsed by express.json()
    // For proper HMAC verification, we need the raw body string
    const rawBody = JSON.stringify(req.body);

    // Calculate HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    // Extract signature from header (may have prefix like "sha256=")
    let receivedSignature = signatureHeader;
    if (signatureHeader.startsWith('sha256=')) {
      receivedSignature = signatureHeader.substring(7);
    }

    // Validate signature lengths match before comparison
    if (calculatedSignature.length !== receivedSignature.length) {
      logger.warn('Webhook signature length mismatch', {
        ip: req.ip,
        path: req.path,
        expectedLength: calculatedSignature.length,
        receivedLength: receivedSignature.length
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    // Use timing-safe comparison to prevent timing attacks
    const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');
    const receivedBuffer = Buffer.from(receivedSignature, 'hex');

    // Verify buffers are the same length (should be caught above, but double-check)
    if (calculatedBuffer.length !== receivedBuffer.length) {
      logger.warn('Webhook signature buffer length mismatch', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    const isValid = crypto.timingSafeEqual(calculatedBuffer, receivedBuffer);

    if (!isValid) {
      logger.warn('Webhook signature verification failed', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    logger.info('Webhook signature verified successfully', {
      ip: req.ip,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Webhook signature verification error:', {
      error: error.message,
      ip: req.ip,
      path: req.path
    });
    return res.status(500).json({
      success: false,
      error: 'Webhook verification failed'
    });
  }
};

module.exports = {
  securityHeaders,
  limiter,
  authLimiter,
  multiSigApprovalLimiter,
  authenticatedUserLimiter,
  sanitizeData,
  xssClean,
  preventParamPollution,
  verifyWebhookSignature
};
