const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/auctionController');

// Public routes (no auth required)
router.get('/', ctrl.getAuctions);
router.get('/:id/bids', ctrl.getBidHistory);

// Authenticated routes - specific /me paths before parameterized /:id
router.use(protect);
router.get('/me/auctions', ctrl.getMyAuctions);
router.get('/me/bids', ctrl.getMyBids);
router.get('/me/watchlist', ctrl.getMyWatchlist);

// Admin routes - specific paths before parameterized /:id
router.post('/admin/:id/approve', authorize('admin'), ctrl.approveAuction);
router.post('/admin/:id/reject', authorize('admin'), ctrl.rejectAuction);

// Bid retraction (specific path before parameterized)
router.post('/bids/:bidId/retract', ctrl.retractBid);

// Parameterized routes
router.get('/:id', ctrl.getAuction);
router.post('/', ctrl.createAuction);
router.put('/:id', ctrl.updateAuction);
router.post('/:id/cancel', ctrl.cancelAuction);
router.post('/:id/bid', ctrl.placeBid);
router.post('/:id/watch', ctrl.watchAuction);
router.delete('/:id/watch', ctrl.unwatchAuction);
router.post('/:id/buy-now', ctrl.buyItNow);

module.exports = router;
