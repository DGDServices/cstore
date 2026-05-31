const lightningMonitoring = require('../services/lightningMonitoring');
const { AppError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Get Lightning Network dashboard metrics
 * @route GET /api/lightning/monitoring/dashboard
 * @access Private/Admin
 */
exports.getDashboard = asyncHandler(async (req, res, next) => {
  const metrics = await lightningMonitoring.getDashboardMetrics();

  res.status(200).json({
    success: true,
    data: metrics
  });
});

/**
 * Get payment statistics
 * @route GET /api/lightning/monitoring/payments
 * @access Private/Admin
 */
exports.getPaymentStats = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  const stats = await lightningMonitoring.getPaymentStats(start, end);

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * Get channel statistics
 * @route GET /api/lightning/monitoring/channels
 * @access Private/Admin
 */
exports.getChannelStats = asyncHandler(async (req, res, next) => {
  const stats = await lightningMonitoring.getChannelStats();

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * Get channel performance metrics
 * @route GET /api/lightning/monitoring/channel-performance
 * @access Private/Admin
 */
exports.getChannelPerformance = asyncHandler(async (req, res, next) => {
  const performance = await lightningMonitoring.getChannelPerformance();

  res.status(200).json({
    success: true,
    data: performance
  });
});

/**
 * Get fee analysis
 * @route GET /api/lightning/monitoring/fees
 * @access Private/Admin
 */
exports.getFeeAnalysis = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  const analysis = await lightningMonitoring.getFeeAnalysis(start, end);

  res.status(200).json({
    success: true,
    data: analysis
  });
});

/**
 * Get transaction history
 * @route GET /api/lightning/monitoring/transactions
 * @access Private/Admin
 */
exports.getTransactionHistory = asyncHandler(async (req, res, next) => {
  const { status, startDate, endDate, limit, skip } = req.query;

  const filters = {};
  if (status) filters.status = status;
  if (startDate) filters.startDate = new Date(startDate);
  if (endDate) filters.endDate = new Date(endDate);

  const options = {};
  if (limit) options.limit = parseInt(limit, 10);
  if (skip) options.skip = parseInt(skip, 10);

  const history = await lightningMonitoring.getTransactionHistory(filters, options);

  res.status(200).json({
    success: true,
    data: history
  });
});

/**
 * Generate analytics report
 * @route GET /api/lightning/monitoring/report
 * @access Private/Admin
 */
exports.generateReport = asyncHandler(async (req, res, next) => {
  const { period } = req.query;

  const report = await lightningMonitoring.generateReport({ period });

  res.status(200).json({
    success: true,
    data: report
  });
});

/**
 * Export report as CSV
 * @route GET /api/lightning/monitoring/export
 * @access Private/Admin
 */
exports.exportReport = asyncHandler(async (req, res, next) => {
  const { period, format } = req.query;

  const report = await lightningMonitoring.generateReport({ period });

  // For now, return JSON. CSV export can be added later
  if (format === 'csv') {
    // TODO: Implement CSV export
    return next(new AppError('CSV export not yet implemented', 501));
  }

  res.status(200).json({
    success: true,
    data: report
  });
});
