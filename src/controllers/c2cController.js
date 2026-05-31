const { asyncHandler, AppError } = require('../middleware/errorHandler');
const c2cService = require('../services/c2cService');

exports.createListing = asyncHandler(async (req, res, next) => {
  const listing = await c2cService.createListing(req.user.id, req.body);
  res.status(201).json({ success: true, data: listing });
});

exports.getListings = asyncHandler(async (req, res, next) => {
  const { category, condition, minPrice, maxPrice, search, radiusKm, status, lng, lat, page, limit } = req.query;

  let userCoords;
  if (lng !== undefined && lat !== undefined) {
    userCoords = [parseFloat(lng), parseFloat(lat)];
  }

  const result = await c2cService.searchListings(
    { category, condition, minPrice, maxPrice, search, radiusKm, status },
    userCoords,
    page,
    limit
  );

  res.json({
    success: true,
    count: result.listings.length,
    total: result.total,
    page: result.page,
    limit: result.limit,
    data: result.listings
  });
});

exports.getListing = asyncHandler(async (req, res, next) => {
  const listing = await c2cService.getListing(req.params.id, req.user && req.user.id);
  if (!listing) return next(new AppError('Listing not found', 404));
  res.json({ success: true, data: listing });
});

exports.updateListing = asyncHandler(async (req, res, next) => {
  const listing = await c2cService.updateListing(req.params.id, req.user.id, req.body);
  res.json({ success: true, data: listing });
});

exports.deleteListing = asyncHandler(async (req, res, next) => {
  await c2cService.removeListing(req.params.id, req.user.id, req.user.role === 'admin');
  res.json({ success: true, data: {} });
});

exports.markAsSold = asyncHandler(async (req, res, next) => {
  const listing = await c2cService.markAsSold(req.params.id, req.user.id);
  res.json({ success: true, data: listing });
});

exports.bumpListing = asyncHandler(async (req, res, next) => {
  const listing = await c2cService.bumpListing(req.params.id, req.user.id);
  res.json({ success: true, data: listing });
});

exports.makeOffer = asyncHandler(async (req, res, next) => {
  const { amount, message } = req.body;
  if (amount === undefined) return next(new AppError('amount is required', 400));
  const result = await c2cService.makeOffer(req.params.id, req.user.id, amount, message);
  res.status(201).json({ success: true, data: result });
});

exports.respondToOffer = asyncHandler(async (req, res, next) => {
  const { response, counterAmount, message } = req.body;
  if (!response) return next(new AppError('response is required', 400));
  const offer = await c2cService.respondToOffer(
    req.params.offerId,
    req.user.id,
    response,
    counterAmount,
    message
  );
  res.json({ success: true, data: offer });
});

exports.getMyListings = asyncHandler(async (req, res, next) => {
  const { status, page, limit } = req.query;
  const result = await c2cService.getMyListings(req.user.id, status, page, limit);
  res.json({
    success: true,
    count: result.listings.length,
    total: result.total,
    page: result.page,
    limit: result.limit,
    data: result.listings
  });
});

exports.getListingOffers = asyncHandler(async (req, res, next) => {
  const offers = await c2cService.getListingOffers(req.params.id, req.user.id);
  res.json({ success: true, count: offers.length, data: offers });
});
