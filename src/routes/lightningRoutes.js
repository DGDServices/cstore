const express = require('express');
const router = express.Router();
const lightningController = require('../controllers/lightningController');
const lightningMonitoringController = require('../controllers/lightningMonitoringController');
const lightningRebalancingController = require('../controllers/lightningRebalancingController');
const lightningWebhookController = require('../controllers/lightningWebhookController');
const { protect, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

/**
 * Public routes - Lightning payment operations
 */

// Get Lightning Network info and status
router.get('/info', lightningController.getLightningInfo);

// Create Lightning invoice for order
router.post(
  '/invoices',
  validate(schemas.createLightningInvoice),
  lightningController.createInvoice
);

// Get invoice status by payment hash
router.get('/invoices/:paymentHash', lightningController.getInvoiceStatus);

// Confirm Lightning payment
router.post(
  '/payments/confirm',
  validate(schemas.confirmLightningPayment),
  lightningController.confirmPayment
);

// Decode Lightning payment request
router.post(
  '/decode',
  validate(schemas.decodeLightningPayment),
  lightningController.decodePaymentRequest
);

/**
 * Protected routes - Admin only
 */

// Get wallet balance
router.get('/balance', protect, authorize('admin'), lightningController.getBalance);

// List all channels
router.get('/channels', protect, authorize('admin'), lightningController.listChannels);

// Open new channel
router.post(
  '/channels',
  protect,
  authorize('admin'),
  validate(schemas.openLightningChannel),
  lightningController.openChannel
);

// Close channel
router.delete('/channels/:channelId', protect, authorize('admin'), lightningController.closeChannel);

// Pay invoice (admin operation)
router.post(
  '/pay',
  protect,
  authorize('admin'),
  validate(schemas.payLightningInvoice),
  lightningController.payInvoice
);

/**
 * Monitoring and Analytics routes - Admin only
 */

// Get dashboard metrics
router.get('/monitoring/dashboard', protect, authorize('admin'), lightningMonitoringController.getDashboard);

// Get payment statistics
router.get('/monitoring/payments', protect, authorize('admin'), lightningMonitoringController.getPaymentStats);

// Get channel statistics
router.get('/monitoring/channels', protect, authorize('admin'), lightningMonitoringController.getChannelStats);

// Get channel performance metrics
router.get('/monitoring/channel-performance', protect, authorize('admin'), lightningMonitoringController.getChannelPerformance);

// Get fee analysis
router.get('/monitoring/fees', protect, authorize('admin'), lightningMonitoringController.getFeeAnalysis);

// Get transaction history
router.get('/monitoring/transactions', protect, authorize('admin'), lightningMonitoringController.getTransactionHistory);

// Generate analytics report
router.get('/monitoring/report', protect, authorize('admin'), lightningMonitoringController.generateReport);

// Export report
router.get('/monitoring/export', protect, authorize('admin'), lightningMonitoringController.exportReport);

/**
 * Channel Rebalancing routes - Admin only
 */

// Get rebalancing recommendations
router.get('/rebalancing/recommendations', protect, authorize('admin'), lightningRebalancingController.getRecommendations);

// Execute manual rebalancing
router.post('/rebalancing/execute', protect, authorize('admin'), lightningRebalancingController.executeRebalancing);

// Execute auto-rebalancing
router.post('/rebalancing/auto', protect, authorize('admin'), lightningRebalancingController.autoRebalance);

// Get rebalancing configuration
router.get('/rebalancing/config', protect, authorize('admin'), lightningRebalancingController.getConfig);

// Update rebalancing configuration
router.put('/rebalancing/config', protect, authorize('admin'), lightningRebalancingController.updateConfig);

// Start auto-rebalancing scheduler
router.post('/rebalancing/scheduler/start', protect, authorize('admin'), lightningRebalancingController.startScheduler);

// Stop auto-rebalancing scheduler
router.post('/rebalancing/scheduler/stop', protect, authorize('admin'), lightningRebalancingController.stopScheduler);

/**
 * Webhook Management routes - Admin only
 */

// Register webhook
router.post('/webhooks', protect, authorize('admin'), lightningWebhookController.registerWebhook);

// Unregister webhook
router.delete('/webhooks', protect, authorize('admin'), lightningWebhookController.unregisterWebhook);

// List webhooks
router.get('/webhooks', protect, authorize('admin'), lightningWebhookController.listWebhooks);

// Test webhook
router.post('/webhooks/test', protect, authorize('admin'), lightningWebhookController.testWebhook);

// Toggle webhooks
router.put('/webhooks/toggle', protect, authorize('admin'), lightningWebhookController.toggleWebhooks);

module.exports = router;
