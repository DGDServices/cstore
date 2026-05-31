const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const tokenBlacklist = require('../utils/tokenBlacklist');
const { logAuthEvent } = require('../utils/auditLogger');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('User already exists with this email', 400));
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password
  });

  // Generate tokens
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  logger.info(`New user registered: ${user.email}`);
  logAuthEvent(user._id.toString(), user.email, 'register', {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken
    }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Find user and include password
  const user = await User.findOne({ email }).select('+password');

  if (!user || !user.isActive) {
    return next(new AppError('Invalid credentials', 401));
  }

  // Check password
  const isPasswordMatch = await user.matchPassword(password);
  if (!isPasswordMatch) {
    return next(new AppError('Invalid credentials', 401));
  }

  // Generate tokens
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  logger.info(`User logged in: ${user.email}`);
  logAuthEvent(user._id.toString(), user.email, 'login', {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken
    }
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferredCurrency: user.preferredCurrency,
        preferredLanguage: user.preferredLanguage,
        country: user.country,
        createdAt: user.createdAt
      }
    }
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res, next) => {
  const { name, email, preferredCurrency, preferredLanguage, country } = req.body;

  const user = await User.findById(req.user.id);

  if (name) user.name = name;
  if (email && email !== user.email) {
    // Check if email is already taken
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }
    user.email = email;
  }
  if (preferredCurrency) user.preferredCurrency = preferredCurrency.toUpperCase();
  if (preferredLanguage) user.preferredLanguage = preferredLanguage.toLowerCase();
  if (country) user.country = country.toUpperCase();

  await user.save();

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferredCurrency: user.preferredCurrency,
        preferredLanguage: user.preferredLanguage,
        country: user.country
      }
    }
  });
});

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
const updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isPasswordMatch = await user.matchPassword(currentPassword);
  if (!isPasswordMatch) {
    return next(new AppError('Current password is incorrect', 401));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Revoke all existing tokens for this user
  try {
    await tokenBlacklist.revokeUserTokens(user._id.toString());
    logger.info(`Password updated and all tokens revoked for user: ${user.email}`);
  } catch (error) {
    logger.error(`Failed to revoke tokens for user ${user.email}:`, error);
    // Continue even if token revocation fails
  }

  // Generate new tokens
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  res.json({
    success: true,
    message: 'Password updated successfully. All other sessions have been logged out.',
    data: {
      token,
      refreshToken
    }
  });
});

// @desc    Logout user and revoke token
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res, next) => {
  // Get token from header
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('No token provided', 400));
  }

  try {
    // Add token to blacklist
    await tokenBlacklist.blacklistToken(token);
    logger.info(`User logged out: ${req.user.email}`);
    logAuthEvent(req.user.id, req.user.email, 'logout', {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error(`Logout failed for user ${req.user.email}:`, error);
    return next(new AppError('Logout failed. Please try again.', 500));
  }
});

// @desc    Logout from all devices (revoke all tokens)
// @route   POST /api/auth/logout-all
// @access  Private
const logoutAll = asyncHandler(async (req, res, next) => {
  try {
    // Revoke all tokens for this user
    await tokenBlacklist.revokeUserTokens(req.user.id);
    logger.info(`All tokens revoked for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    logger.error(`Logout all failed for user ${req.user.email}:`, error);
    return next(new AppError('Logout failed. Please try again.', 500));
  }
});

module.exports = {
  register,
  login,
  logout,
  logoutAll,
  getMe,
  updateProfile,
  updatePassword
};
