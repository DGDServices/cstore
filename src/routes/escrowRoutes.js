const express = require('express');
const router = express.Router();
const {
  createEscrow,
  getEscrows,
  getEscrow,
  fundEscrow,
  releaseEscrow,
  refundEscrow,
  fileDispute,
  resolveDispute,
  completeMilestone,
  releaseMilestone,
  cancelEscrow,
  getEscrowStats
} = require('../controllers/escrowController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const escrowValidation = require('../validation/escrowValidation');

// All routes require authentication
router.use(protect);

// Public escrow routes (for authenticated users)
router
  .route('/')
  .get(getEscrows)
  .post(validate(escrowValidation.createEscrow), createEscrow);

router.get('/stats', authorize('admin'), getEscrowStats);

router
  .route('/:id')
  .get(getEscrow);

// Escrow action routes
router.post('/:id/fund', validate(escrowValidation.fundEscrow), fundEscrow);
router.post('/:id/release', releaseEscrow);
router.post('/:id/refund', validate(escrowValidation.refundEscrow), refundEscrow);
router.post('/:id/cancel', cancelEscrow);

// Dispute routes
router.post('/:id/dispute', validate(escrowValidation.fileDispute), fileDispute);
router.post('/:id/dispute/:disputeId/resolve', 
  authorize('admin'), 
  validate(escrowValidation.resolveDispute), 
  resolveDispute
);

// Milestone routes
router.post('/:id/milestone/:milestoneId/complete', completeMilestone);
router.post('/:id/milestone/:milestoneId/release', releaseMilestone);

module.exports = router;
