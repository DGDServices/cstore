const express = require('express');
const router = express.Router();
const conversionController = require('../controllers/conversionController');
const { protect } = require('../middleware/auth');

/**
 * Conversion Routes
 * Handles routing for conversion operations
 */

// Public routes (require authentication)
router.post(
  '/initiate',
  protect,
  conversionController.initiateConversion
);

router.get(
  '/:id/status',
  protect,
  conversionController.getConversionStatus
);

router.get(
  '/history',
  protect,
  conversionController.getConversionHistory
);

// Admin routes (require admin privileges)
router.post(
  '/:id/approve',
  protect,
  conversionController.approveConversion
);

router.post(
  '/:id/reject',
  protect,
  conversionController.rejectConversion
);

router.get(
  '/stats',
  protect,
  conversionController.getConversionStats
);

router.get(
  '/pending-approvals',
  protect,
  conversionController.getPendingApprovals
);

// Risk assessment
router.post(
  '/assess-risk',
  protect,
  conversionController.assessRisk
);

module.exports = router;
