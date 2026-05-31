const Escrow = require('../models/Escrow');
const Order = require('../models/Order');
const escrowService = require('../services/escrowService');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Create a new escrow contract
 * POST /api/escrow
 * @access Private
 */
exports.createEscrow = asyncHandler(async (req, res, next) => {
  const {
    buyer,
    seller,
    orderId,
    title,
    description,
    amount,
    cryptocurrency,
    amountUSD,
    depositAddress,
    releaseAddress,
    refundAddress,
    releaseType,
    releaseConditions,
    milestones,
    metadata
  } = req.body;
  
  // Validate user is either buyer or seller
  const userId = req.user.id;
  if (userId !== buyer && userId !== seller) {
    return next(new AppError('You must be either the buyer or seller', 403));
  }
  
  // Validate order if provided
  if (orderId) {
    const order = await Order.findById(orderId);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }
    
    // Check if order already has an escrow
    const existingEscrow = await Escrow.findOne({
      order: orderId,
      status: { $nin: ['cancelled', 'completed', 'refunded'] }
    });
    
    if (existingEscrow) {
      return next(new AppError('Order already has an active escrow', 400));
    }
  }
  
  const escrowData = {
    buyer,
    seller,
    order: orderId || null,
    title,
    description,
    amount,
    cryptocurrency,
    amountUSD,
    depositAddress,
    releaseAddress,
    refundAddress,
    releaseType,
    releaseConditions: releaseConditions || [],
    milestones: milestones || [],
    metadata: metadata || {}
  };
  
  const escrow = await escrowService.createEscrow(escrowData, userId);
  
  await escrow.populate('buyer seller order');
  
  logger.info('Escrow created via API', {
    escrowId: escrow._id,
    userId,
    buyer,
    seller
  });
  
  res.status(201).json({
    success: true,
    data: escrow
  });
});

/**
 * Get all escrows for the authenticated user
 * GET /api/escrow
 * @access Private
 */
exports.getEscrows = asyncHandler(async (req, res) => {
  const { status, role } = req.query;
  const userId = req.user.id;
  
  // Build query
  const query = {};
  
  // Filter by role (buyer or seller)
  if (role === 'buyer') {
    query.buyer = userId;
  } else if (role === 'seller') {
    query.seller = userId;
  } else {
    // Get all escrows where user is either buyer or seller
    query.$or = [
      { buyer: userId },
      { seller: userId }
    ];
  }
  
  // Filter by status
  if (status) {
    query.status = status;
  }
  
  const escrows = await Escrow.find(query)
    .populate('buyer', 'name email')
    .populate('seller', 'name email')
    .populate('order')
    .populate('multiSigWallet')
    .sort({ createdAt: -1 });
  
  res.json({
    success: true,
    count: escrows.length,
    data: escrows
  });
});

/**
 * Get a single escrow by ID
 * GET /api/escrow/:id
 * @access Private
 */
exports.getEscrow = asyncHandler(async (req, res, next) => {
  const escrow = await Escrow.findById(req.params.id)
    .populate('buyer', 'name email')
    .populate('seller', 'name email')
    .populate('order')
    .populate('multiSigWallet')
    .populate('disputes.filedBy', 'name email')
    .populate('disputes.resolvedBy', 'name email')
    .populate('multiSigApprovals.user', 'name email')
    .populate('history.performedBy', 'name email');
  
  if (!escrow) {
    return next(new AppError('Escrow not found', 404));
  }
  
  // Check if user is a party or admin
  const userId = req.user.id;
  if (!escrow.isParty(userId) && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to view this escrow', 403));
  }
  
  res.json({
    success: true,
    data: escrow
  });
});

/**
 * Fund an escrow with cryptocurrency
 * POST /api/escrow/:id/fund
 * @access Private
 */
exports.fundEscrow = asyncHandler(async (req, res, next) => {
  const { transactionHash } = req.body;
  
  if (!transactionHash) {
    return next(new AppError('Transaction hash is required', 400));
  }
  
  const escrow = await Escrow.findById(req.params.id);
  
  if (!escrow) {
    return next(new AppError('Escrow not found', 404));
  }
  
  // Verify user is the buyer
  if (escrow.buyer.toString() !== req.user.id) {
    return next(new AppError('Only the buyer can fund the escrow', 403));
  }
  
  const fundedEscrow = await escrowService.fundEscrow(
    req.params.id,
    transactionHash,
    req.user.id
  );
  
  await fundedEscrow.populate('buyer seller order');
  
  res.json({
    success: true,
    message: 'Escrow funded successfully',
    data: fundedEscrow
  });
});

/**
 * Release escrow funds to seller
 * POST /api/escrow/:id/release
 * @access Private
 */
exports.releaseEscrow = asyncHandler(async (req, res, next) => {
  const { signature } = req.body;
  
  const escrow = await Escrow.findById(req.params.id);
  
  if (!escrow) {
    return next(new AppError('Escrow not found', 404));
  }
  
  // Check authorization
  if (!escrow.canPerformAction(req.user.id, 'release')) {
    return next(new AppError('Not authorized to release this escrow', 403));
  }
  
  const result = await escrowService.releaseEscrow(
    req.params.id,
    req.user.id,
    signature
  );
  
  await result.escrow.populate('buyer seller order');
  
  const message = result.status === 'pending_approval' 
    ? 'Release approval recorded, waiting for additional approvals'
    : 'Escrow released successfully';
  
  res.json({
    success: true,
    message,
    status: result.status,
    data: result.escrow
  });
});

/**
 * Refund escrow funds to buyer
 * POST /api/escrow/:id/refund
 * @access Private
 */
exports.refundEscrow = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  
  if (!reason) {
    return next(new AppError('Refund reason is required', 400));
  }
  
  const escrow = await Escrow.findById(req.params.id);
  
  if (!escrow) {
    return next(new AppError('Escrow not found', 404));
  }
  
  // Check authorization
  if (!escrow.canPerformAction(req.user.id, 'refund')) {
    return next(new AppError('Not authorized to refund this escrow', 403));
  }
  
  const result = await escrowService.refundEscrow(
    req.params.id,
    req.user.id,
    reason
  );
  
  await result.escrow.populate('buyer seller order');
  
  const message = result.status === 'pending_approval'
    ? 'Refund approval recorded, waiting for additional approvals'
    : 'Escrow refunded successfully';
  
  res.json({
    success: true,
    message,
    status: result.status,
    data: result.escrow
  });
});

/**
 * File a dispute
 * POST /api/escrow/:id/dispute
 * @access Private
 */
exports.fileDispute = asyncHandler(async (req, res, next) => {
  const { reason, description, evidence } = req.body;
  
  if (!reason || !description) {
    return next(new AppError('Reason and description are required', 400));
  }
  
  const escrow = await Escrow.findById(req.params.id);
  
  if (!escrow) {
    return next(new AppError('Escrow not found', 404));
  }
  
  // Check if user is a party
  if (!escrow.isParty(req.user.id)) {
    return next(new AppError('Only escrow parties can file disputes', 403));
  }
  
  const disputeData = {
    reason,
    description,
    evidence: evidence || []
  };
  
  const disputedEscrow = await escrowService.fileDispute(
    req.params.id,
    req.user.id,
    disputeData
  );
  
  await disputedEscrow.populate('buyer seller disputes.filedBy');
  
  res.json({
    success: true,
    message: 'Dispute filed successfully',
    data: disputedEscrow
  });
});

/**
 * Resolve a dispute (Admin only)
 * POST /api/escrow/:id/dispute/:disputeId/resolve
 * @access Private (Admin)
 */
exports.resolveDispute = asyncHandler(async (req, res, next) => {
  const { type, details } = req.body;
  
  if (!type) {
    return next(new AppError('Resolution type is required', 400));
  }
  
  if (!['buyer_favor', 'seller_favor', 'partial_refund', 'custom'].includes(type)) {
    return next(new AppError('Invalid resolution type', 400));
  }
  
  const resolution = {
    type,
    details: details || ''
  };
  
  const resolvedEscrow = await escrowService.resolveDispute(
    req.params.id,
    req.params.disputeId,
    resolution,
    req.user.id
  );
  
  await resolvedEscrow.populate('buyer seller disputes.filedBy disputes.resolvedBy');
  
  res.json({
    success: true,
    message: 'Dispute resolved successfully',
    data: resolvedEscrow
  });
});

/**
 * Complete a milestone
 * POST /api/escrow/:id/milestone/:milestoneId/complete
 * @access Private
 */
exports.completeMilestone = asyncHandler(async (req, res, next) => {
  const escrow = await Escrow.findById(req.params.id);
  
  if (!escrow) {
    return next(new AppError('Escrow not found', 404));
  }
  
  // Seller can mark milestone as complete
  if (escrow.seller.toString() !== req.user.id) {
    return next(new AppError('Only the seller can complete milestones', 403));
  }
  
  const updatedEscrow = await escrowService.completeMilestone(
    req.params.id,
    req.params.milestoneId,
    req.user.id
  );
  
  await updatedEscrow.populate('buyer seller');
  
  res.json({
    success: true,
    message: 'Milestone completed successfully',
    data: updatedEscrow
  });
});

/**
 * Release milestone funds
 * POST /api/escrow/:id/milestone/:milestoneId/release
 * @access Private
 */
exports.releaseMilestone = asyncHandler(async (req, res, next) => {
  const escrow = await Escrow.findById(req.params.id);
  
  if (!escrow) {
    return next(new AppError('Escrow not found', 404));
  }
  
  // Buyer can release milestone funds
  if (escrow.buyer.toString() !== req.user.id) {
    return next(new AppError('Only the buyer can release milestone funds', 403));
  }
  
  const updatedEscrow = await escrowService.releaseMilestone(
    req.params.id,
    req.params.milestoneId,
    req.user.id
  );
  
  await updatedEscrow.populate('buyer seller');
  
  res.json({
    success: true,
    message: 'Milestone funds released successfully',
    data: updatedEscrow
  });
});

/**
 * Cancel an escrow
 * POST /api/escrow/:id/cancel
 * @access Private
 */
exports.cancelEscrow = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  
  const escrow = await Escrow.findById(req.params.id);
  
  if (!escrow) {
    return next(new AppError('Escrow not found', 404));
  }
  
  // Check authorization
  if (!escrow.canPerformAction(req.user.id, 'cancel')) {
    return next(new AppError('Not authorized to cancel this escrow', 403));
  }
  
  const cancelledEscrow = await escrowService.cancelEscrow(
    req.params.id,
    req.user.id,
    reason
  );
  
  await cancelledEscrow.populate('buyer seller');
  
  res.json({
    success: true,
    message: 'Escrow cancelled successfully',
    data: cancelledEscrow
  });
});

/**
 * Get escrow statistics (Admin only)
 * GET /api/escrow/stats
 * @access Private (Admin)
 */
exports.getEscrowStats = asyncHandler(async (req, res) => {
  const stats = await Escrow.aggregate([
    {
      $facet: {
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
              totalAmountUSD: { $sum: '$amountUSD' }
            }
          }
        ],
        byCryptocurrency: [
          {
            $group: {
              _id: '$cryptocurrency',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' }
            }
          }
        ],
        total: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmountUSD: { $sum: '$amountUSD' },
              avgAmountUSD: { $avg: '$amountUSD' }
            }
          }
        ],
        disputes: [
          {
            $match: { status: 'disputed' }
          },
          {
            $count: 'count'
          }
        ],
        activeEscrows: [
          {
            $match: { 
              status: { $in: ['funded', 'active'] }
            }
          },
          {
            $count: 'count'
          }
        ]
      }
    }
  ]);
  
  res.json({
    success: true,
    data: stats[0]
  });
});
