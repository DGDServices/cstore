const lightningWebhook = require('../services/lightningWebhook');
const { AppError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Register a webhook
 * @route POST /api/lightning/webhooks
 * @access Private/Admin
 */
exports.registerWebhook = asyncHandler(async (req, res, next) => {
  const { url, events, secret } = req.body;

  if (!url) {
    return next(new AppError('Webhook URL is required', 400));
  }

  const webhook = lightningWebhook.registerWebhook(url, { events, secret });

  logger.info(`Webhook registered: ${url}`);

  res.status(201).json({
    success: true,
    message: 'Webhook registered successfully',
    data: webhook
  });
});

/**
 * Unregister a webhook
 * @route DELETE /api/lightning/webhooks
 * @access Private/Admin
 */
exports.unregisterWebhook = asyncHandler(async (req, res, next) => {
  const { url } = req.body;

  if (!url) {
    return next(new AppError('Webhook URL is required', 400));
  }

  const success = lightningWebhook.unregisterWebhook(url);

  if (!success) {
    return next(new AppError('Webhook not found', 404));
  }

  logger.info(`Webhook unregistered: ${url}`);

  res.status(200).json({
    success: true,
    message: 'Webhook unregistered successfully'
  });
});

/**
 * List all webhooks
 * @route GET /api/lightning/webhooks
 * @access Private/Admin
 */
exports.listWebhooks = asyncHandler(async (req, res, next) => {
  const webhooks = lightningWebhook.getWebhooks();

  res.status(200).json({
    success: true,
    data: {
      webhooks,
      count: webhooks.length
    }
  });
});

/**
 * Test webhook delivery
 * @route POST /api/lightning/webhooks/test
 * @access Private/Admin
 */
exports.testWebhook = asyncHandler(async (req, res, next) => {
  const { url } = req.body;

  if (!url) {
    return next(new AppError('Webhook URL is required', 400));
  }

  const result = await lightningWebhook.testWebhook(url);

  res.status(200).json({
    success: result.success,
    message: result.message,
    error: result.error
  });
});

/**
 * Enable/disable webhooks globally
 * @route PUT /api/lightning/webhooks/toggle
 * @access Private/Admin
 */
exports.toggleWebhooks = asyncHandler(async (req, res, next) => {
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return next(new AppError('Enabled flag must be a boolean', 400));
  }

  lightningWebhook.setEnabled(enabled);

  res.status(200).json({
    success: true,
    message: `Webhooks ${enabled ? 'enabled' : 'disabled'}`
  });
});
