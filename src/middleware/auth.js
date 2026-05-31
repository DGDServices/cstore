const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const { AppError } = require('./errorHandler');
const tokenBlacklist = require('../utils/tokenBlacklist');
const { isTokenBlacklisted } = require('../utils/tokenBlacklist');
const logger = require('../utils/logger');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  let token;

  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if token exists
  if (!token) {
    return next(new AppError('Not authorized to access this route', 401));
  }

  try {
    // Check if token is blacklisted using isTokenBlacklisted function
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      logger.warn(`Blacklisted token attempt: ${token.substring(0, 20)}...`);
      return next(new AppError('Token has been revoked', 401));
    }

    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return next(new AppError('Invalid or expired token', 401));
    }

    // Check if all user tokens are revoked (password change, security breach, etc.)
    const areRevoked = await tokenBlacklist.areUserTokensRevoked(decoded.id, decoded.iat);
    if (areRevoked) {
      logger.warn(`Revoked user token attempt: User ${decoded.id}`);
      return next(new AppError('Token has been revoked. Please log in again.', 401));
    }

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return next(new AppError('User no longer exists or is inactive', 401));
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError('Not authorized to access this route', 401));
  }
};

// Check if user is admin
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`User role '${req.user.role}' is not authorized to access this route`, 403));
    }
    next();
  };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await User.findById(decoded.id).select('-password');
        if (user && user.isActive) {
          req.user = user;
        }
      }
    } catch (error) {
      // Silently continue without user
    }
  }

  next();
};

module.exports = { protect, authorize, optionalAuth };
