const logger = require('../utils/logger');

/**
 * HTTPS Enforcement Middleware
 * Enforces HTTPS in production and adds security headers
 */

/**
 * Force HTTPS redirect middleware
 * Redirects all HTTP traffic to HTTPS in production
 */
const forceHttps = (req, res, next) => {
  // Skip in development or if explicitly disabled
  if (process.env.NODE_ENV !== 'production' || process.env.FORCE_HTTPS !== 'true') {
    return next();
  }

  // Check if request is already secure
  const isSecure = req.secure || 
                   req.headers['x-forwarded-proto'] === 'https' ||
                   req.headers['x-forwarded-ssl'] === 'on';

  if (!isSecure) {
    const httpsUrl = `https://${req.hostname}${req.url}`;
    logger.info(`Redirecting HTTP request to HTTPS: ${req.url}`);
    return res.redirect(301, httpsUrl);
  }

  next();
};

/**
 * Add HSTS (HTTP Strict Transport Security) header
 * Forces browsers to only use HTTPS for future requests
 */
const addHstsHeader = (req, res, next) => {
  // Only add HSTS in production with HTTPS enabled
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true') {
    const maxAge = parseInt(process.env.HSTS_MAX_AGE || 31536000); // Default 1 year
    const includeSubDomains = process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false';
    const preload = process.env.HSTS_PRELOAD === 'true';

    let hstsValue = `max-age=${maxAge}`;
    if (includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }
    if (preload) {
      hstsValue += '; preload';
    }

    res.setHeader('Strict-Transport-Security', hstsValue);
  }

  next();
};

/**
 * Combined HTTPS enforcement middleware
 * Applies both HTTPS redirect and HSTS header
 */
const enforceHttps = (req, res, next) => {
  forceHttps(req, res, (err) => {
    if (err) return next(err);
    addHstsHeader(req, res, next);
  });
};

/**
 * Check if HTTPS is properly configured
 * @returns {Object} Configuration status
 */
const getHttpsStatus = () => {
  return {
    enabled: process.env.FORCE_HTTPS === 'true',
    environment: process.env.NODE_ENV,
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || 31536000),
    hstsIncludeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
    hstsPreload: process.env.HSTS_PRELOAD === 'true'
  };
};

/**
 * Middleware to block non-HTTPS requests entirely (stricter than redirect)
 * Use this for critical endpoints that should never be accessed over HTTP
 */
const requireHttps = (req, res, next) => {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const isSecure = req.secure || 
                   req.headers['x-forwarded-proto'] === 'https' ||
                   req.headers['x-forwarded-ssl'] === 'on';

  if (!isSecure) {
    logger.warn(`Blocked non-HTTPS request to protected endpoint: ${req.url}`);
    return res.status(403).json({
      success: false,
      error: 'HTTPS Required',
      message: 'This endpoint requires a secure HTTPS connection'
    });
  }

  next();
};

/**
 * Middleware to ensure secure cookies
 * Sets secure flag on cookies when HTTPS is enabled
 */
const secureSessionCookies = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true') {
    // Override res.cookie to automatically set secure flag
    const originalCookie = res.cookie.bind(res);
    res.cookie = function(name, value, options = {}) {
      options.secure = true;
      options.httpOnly = true;
      options.sameSite = options.sameSite || 'strict';
      return originalCookie(name, value, options);
    };
  }

  next();
};

module.exports = {
  forceHttps,
  addHstsHeader,
  enforceHttps,
  requireHttps,
  secureSessionCookies,
  getHttpsStatus
};
