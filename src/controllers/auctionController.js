const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const AuctionWatch = require('../models/AuctionWatch');
const Seller = require('../models/Seller');
const auctionService = require('../services/auctionService');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

exports.createAuction = asyncHandler(async (req, res, next) => {
  const sellerAccount = await Seller.findOne({ user: req.user.id });

  const auction = await auctionService.createAuction(
    { ...req.body, sellerAccount: sellerAccount ? sellerAccount._id : undefined },
    req.user.id
  );

  res.status(201).json({ success: true, data: auction });
});

exports.getAuctions = asyncHandler(async (req, res, next) => {
  const { status, category, auctionType, minPrice, maxPrice, search, page, limit } = req.query;
  const result = await auctionService.getAuctions(
    { status, category, auctionType, minPrice, maxPrice, search },
    page,
    limit
  );

  res.json({
    success: true,
    count: result.auctions.length,
    total: result.total,
    page: result.page,
    limit: result.limit,
    data: result.auctions
  });
});

exports.getAuction = asyncHandler(async (req, res, next) => {
  const auction = await auctionService.getAuction(req.params.id);
  if (!auction) {
    return next(new AppError('Auction not found', 404));
  }

  // Fire-and-forget view increment
  Auction.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).catch(() => {});

  res.json({ success: true, data: auction });
});

exports.updateAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    return next(new AppError('Auction not found', 404));
  }
  if (auction.seller.toString() !== req.user.id) {
    return next(new AppError('Not authorized to update this auction', 403));
  }
  if (!['draft', 'scheduled'].includes(auction.status)) {
    return next(new AppError('Cannot update auction after it has started', 400));
  }

  const { title, description, images, shippingOptions } = req.body;
  if (title !== undefined) auction.title = title;
  if (description !== undefined) auction.description = description;
  if (images !== undefined) auction.images = images;
  if (shippingOptions !== undefined) auction.shippingOptions = shippingOptions;

  await auction.save();
  res.json({ success: true, data: auction });
});

exports.cancelAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    return next(new AppError('Auction not found', 404));
  }

  const isSeller = auction.seller.toString() === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isSeller && !isAdmin) {
    return next(new AppError('Not authorized to cancel this auction', 403));
  }
  if (!['draft', 'scheduled', 'active'].includes(auction.status)) {
    return next(new AppError('Cannot cancel auction in its current state', 400));
  }
  if (auction.status === 'active' && auction.totalBids > 0 && !isAdmin) {
    return next(new AppError('Cannot cancel an active auction with existing bids', 400));
  }

  auction.status = 'cancelled';
  await auction.save();

  res.json({ success: true, data: auction });
});

exports.placeBid = asyncHandler(async (req, res, next) => {
  const { amount, maxProxyBid } = req.body;
  if (!amount) {
    return next(new AppError('Bid amount is required', 400));
  }

  const result = await auctionService.placeBid(
    req.params.id,
    req.user.id,
    parseFloat(amount),
    maxProxyBid ? parseFloat(maxProxyBid) : undefined,
    req.ip
  );

  res.status(201).json({ success: true, data: result });
});

exports.getBidHistory = asyncHandler(async (req, res, next) => {
  const bids = await auctionService.getBidHistory(req.params.id, req.query.limit);
  res.json({ success: true, count: bids.length, data: bids });
});

exports.watchAuction = asyncHandler(async (req, res, next) => {
  const watch = await auctionService.watchAuction(req.params.id, req.user.id, req.body);
  res.status(201).json({ success: true, data: watch });
});

exports.unwatchAuction = asyncHandler(async (req, res, next) => {
  const result = await auctionService.unwatchAuction(req.params.id, req.user.id);
  res.json({ success: true, data: result });
});

exports.buyItNow = asyncHandler(async (req, res, next) => {
  const auction = await auctionService.buyItNow(req.params.id, req.user.id);
  res.json({ success: true, data: auction });
});

exports.retractBid = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  const bid = await auctionService.retractBid(
    req.params.bidId,
    req.user.id,
    reason,
    req.user.role === 'admin'
  );
  res.json({ success: true, data: bid });
});

exports.getMyAuctions = asyncHandler(async (req, res, next) => {
  const auctions = await Auction.find({ seller: req.user.id }).sort({ createdAt: -1 });
  res.json({ success: true, count: auctions.length, data: auctions });
});

exports.getMyBids = asyncHandler(async (req, res, next) => {
  const bids = await Bid.find({ bidder: req.user.id })
    .sort({ createdAt: -1 })
    .populate('auction', 'title endTime currentPrice status');
  res.json({ success: true, count: bids.length, data: bids });
});

exports.getMyWatchlist = asyncHandler(async (req, res, next) => {
  const watchlist = await AuctionWatch.find({ user: req.user.id })
    .populate('auction');
  res.json({ success: true, count: watchlist.length, data: watchlist });
});

exports.approveAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    return next(new AppError('Auction not found', 404));
  }

  const now = new Date();
  auction.moderationStatus = 'approved';
  auction.status = auction.startTime <= now ? 'active' : 'scheduled';
  await auction.save();

  res.json({ success: true, data: auction });
});

exports.rejectAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    return next(new AppError('Auction not found', 404));
  }

  auction.moderationStatus = 'rejected';
  auction.status = 'cancelled';
  await auction.save();

  res.json({ success: true, data: auction });
});
