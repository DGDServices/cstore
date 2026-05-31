const express = require('express');
const router = express.Router();
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/c2cController');

// Public routes (optional auth for listing view)
router.get('/', ctrl.getListings);
router.get('/:id', optionalAuth, ctrl.getListing);

// All routes below require authentication
router.use(protect);

// IMPORTANT: /me/listings and /offers/:offerId/respond must come BEFORE /:id routes
router.get('/me/listings', ctrl.getMyListings);
router.post('/offers/:offerId/respond', ctrl.respondToOffer);

router.post('/', ctrl.createListing);
router.put('/:id', ctrl.updateListing);
router.delete('/:id', ctrl.deleteListing);
router.post('/:id/sold', ctrl.markAsSold);
router.post('/:id/bump', ctrl.bumpListing);
router.get('/:id/offers', ctrl.getListingOffers);
router.post('/:id/offer', ctrl.makeOffer);

module.exports = router;
