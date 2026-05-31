const lightningRebalancing = require('../services/lightningRebalancing');
const { AppError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Get rebalancing recommendations
 * @route GET /api/lightning/rebalancing/recommendations
 * @access Private/Admin
 */
exports.getRecommendations = asyncHandler(async (req, res, next) => {
  const recommendations = await lightningRebalancing.getRecommendations();

  res.status(200).json({
    success: true,
    data: recommendations
  });
});

/**
 * Execute manual rebalancing for a channel
 * @route POST /api/lightning/rebalancing/execute
 * @access Private/Admin
 */
exports.executeRebalancing = asyncHandler(async (req, res, next) => {
  const { channelId, amount, direction } = req.body;

  if (!channelId || !amount || !direction) {
    return next(new AppError('Channel ID, amount, and direction are required', 400));
  }

  if (!['inbound', 'outbound'].includes(direction)) {
    return next(new AppError('Direction must be either "inbound" or "outbound"', 400));
  }

  const result = await lightningRebalancing.rebalanceChannel(channelId, amount, direction);

  logger.info(`Manual rebalancing executed for channel ${channelId}`);

  res.status(200).json({
    success: true,
    message: 'Rebalancing executed',
    data: result
  });
});

/**
 * Execute auto-rebalancing for all channels
 * @route POST /api/lightning/rebalancing/auto
 * @access Private/Admin
 */
exports.autoRebalance = asyncHandler(async (req, res, next) => {
  const result = await lightningRebalancing.autoRebalanceAll();

  res.status(200).json({
    success: true,
    message: 'Auto-rebalancing completed',
    data: result
  });
});

/**
 * Get rebalancing configuration
 * @route GET /api/lightning/rebalancing/config
 * @access Private/Admin
 */
exports.getConfig = asyncHandler(async (req, res, next) => {
  const config = lightningRebalancing.getConfig();

  res.status(200).json({
    success: true,
    data: config
  });
});

/**
 * Update rebalancing configuration
 * @route PUT /api/lightning/rebalancing/config
 * @access Private/Admin
 */
exports.updateConfig = asyncHandler(async (req, res, next) => {
  const config = req.body;

  lightningRebalancing.updateConfig(config);

  res.status(200).json({
    success: true,
    message: 'Configuration updated',
    data: lightningRebalancing.getConfig()
  });
});

/**
 * Start auto-rebalancing scheduler
 * @route POST /api/lightning/rebalancing/scheduler/start
 * @access Private/Admin
 */
exports.startScheduler = asyncHandler(async (req, res, next) => {
  const { intervalMs } = req.body;

  lightningRebalancing.startAutoRebalancing(intervalMs);

  res.status(200).json({
    success: true,
    message: 'Auto-rebalancing scheduler started'
  });
});

/**
 * Stop auto-rebalancing scheduler
 * @route POST /api/lightning/rebalancing/scheduler/stop
 * @access Private/Admin
 */
exports.stopScheduler = asyncHandler(async (req, res, next) => {
  lightningRebalancing.stopAutoRebalancing();

  res.status(200).json({
    success: true,
    message: 'Auto-rebalancing scheduler stopped'
  });
});
