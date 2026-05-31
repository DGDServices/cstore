const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/contentModerationController');

// Rate limiter for law enforcement endpoint (10 req/hour per IP)
const leLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for moderation review actions (30 req/15 min per IP)
const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

// Law enforcement endpoint - uses x-le-api-key header, not JWT
router.post('/law-enforcement', leLimiter, ctrl.handleLERequest);

// Prohibited item rules must be declared before /:id to avoid route conflicts
router.get('/rules', protect, authorize('admin'), ctrl.getProhibitedItemRules);
router.post('/rules', protect, authorize('admin'), ctrl.createProhibitedItemRule);
router.put('/rules/:id', protect, authorize('admin'), ctrl.updateProhibitedItemRule);
router.delete('/rules/:id', protect, authorize('admin'), ctrl.deleteProhibitedItemRule);

// All remaining routes require JWT auth
router.use(protect);

// Moderation queue management (admin)
router.get('/queue', authorize('admin'), ctrl.getModerationQueue);
router.get('/legal-holds', authorize('admin'), ctrl.getLegalHolds);
router.get('/:id', authorize('admin'), ctrl.getModerationLog);
router.post('/:id/review', authorize('admin'), reviewLimiter, ctrl.reviewContent);
router.post('/:id/appeal', ctrl.appealDecision);

module.exports = router;
