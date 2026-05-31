const express = require('express');
const router = express.Router();
const {
  getPodProducts,
  getPodProduct,
  syncPrintifyProducts,
  createPodOrder,
  submitPodOrder,
  getPodOrder,
  listPodOrders,
  cancelPodOrder
} = require('../controllers/podController');
const { handlePrintifyWebhook } = require('../controllers/printifyWebhookController');
const { verifyPrintifyWebhook } = require('../middleware/printifyWebhook');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/products', getPodProducts);
router.get('/products/:id', getPodProduct);

// Protected routes (authenticated users)
router.post('/orders', protect, createPodOrder);
router.get('/orders/:id', protect, getPodOrder);

// Admin routes
router.post('/products/sync', protect, authorize('admin'), syncPrintifyProducts);
router.get('/orders', protect, authorize('admin'), listPodOrders);
router.post('/orders/:id/submit', protect, authorize('admin'), submitPodOrder);
router.post('/orders/:id/cancel', protect, authorize('admin'), cancelPodOrder);

// Webhook route (public but signature verified)
router.post('/webhooks', verifyPrintifyWebhook, handlePrintifyWebhook);

module.exports = router;
