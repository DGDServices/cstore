const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/sellerController');

// Public routes
router.get('/storefront/:slug', ctrl.getSellerStorefront);
router.get('/products/:productId/offers', ctrl.getProductOffers);

// Authenticated seller routes
router.use(protect);
router.post('/', ctrl.registerSeller);
router.get('/me', ctrl.getMySellerAccount);
router.put('/me', ctrl.updateSellerProfile);
router.post('/me/verification', ctrl.submitVerification);
router.get('/me/products', ctrl.getMyProducts);
router.post('/me/products', ctrl.addSellerProduct);
router.put('/me/products/:id', ctrl.updateSellerProduct);
router.delete('/me/products/:id', ctrl.removeSellerProduct);

// Admin routes
router.get('/admin/verifications', authorize('admin'), ctrl.getPendingVerifications);
router.post('/admin/:id/verify', authorize('admin'), ctrl.approveVerification);
router.post('/admin/:id/violation', authorize('admin'), ctrl.issueViolation);
router.get('/admin/commission-rules', authorize('admin'), ctrl.getCommissionRules);
router.post('/admin/commission-rules', authorize('admin'), ctrl.createCommissionRule);
router.put('/admin/commission-rules/:id', authorize('admin'), ctrl.updateCommissionRule);

module.exports = router;
