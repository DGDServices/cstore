const TransactionApproval = require('../models/TransactionApproval');
const MultiSigWallet = require('../models/MultiSigWallet');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { verifyTransaction } = require('../services/blockchainService');

/**
 * Create a transaction approval request
 * POST /api/wallets/multi-sig/transactions
 * @access Private
 */
exports.createTransactionApproval = asyncHandler(async (req, res, next) => {
  const { walletId, orderId, amount, toAddress, description } = req.body;
  
  // Find wallet
  const wallet = await MultiSigWallet.findById(walletId);
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }
  
  if (!wallet.isActive) {
    return next(new AppError('Wallet is not active', 400));
  }
  
  // Check if user has access to wallet
  if (!wallet.hasAccess(req.user.id)) {
    return next(new AppError('You do not have access to this wallet', 403));
  }
  
  // Validate order if provided
  let order = null;
  if (orderId) {
    order = await Order.findById(orderId);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }
    
    // Check if order already has a transaction approval pending
    const existingApproval = await TransactionApproval.findOne({
      order: orderId,
      status: { $in: ['pending', 'approved'] }
    });
    
    if (existingApproval) {
      return next(new AppError('Transaction approval already exists for this order', 400));
    }
  }
  
  // Create transaction approval
  const transactionApproval = await TransactionApproval.create({
    wallet: walletId,
    order: orderId || null,
    cryptocurrency: wallet.cryptocurrency,
    amount,
    toAddress,
    fromAddress: wallet.address,
    requiredApprovals: wallet.requiredSignatures,
    description,
    metadata: {
      initiatedBy: req.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });
  
  await transactionApproval.populate('wallet');
  await transactionApproval.populate('order');
  await transactionApproval.populate('metadata.initiatedBy', 'name email');
  
  // Enhanced security logging for multi-sig operations
  logger.logMultiSigOperation('transaction_created', {
    transactionId: transactionApproval._id,
    walletId,
    userId: req.user.id,
    userEmail: req.user.email,
    amount,
    cryptocurrency: wallet.cryptocurrency,
    toAddress,
    orderId: orderId || null,
    requiredApprovals: wallet.requiredSignatures
  });
  
  res.status(201).json({
    success: true,
    data: transactionApproval
  });
});

/**
 * Get all transaction approvals
 * GET /api/wallets/multi-sig/transactions
 * @access Private
 */
exports.getTransactionApprovals = asyncHandler(async (req, res, next) => {
  const { status, walletId } = req.query;
  
  // Build query - find transactions where user has access to wallet
  const walletQuery = {
    $or: [
      { owner: req.user.id },
      { 'signers.user': req.user.id }
    ]
  };
  
  if (walletId) {
    walletQuery._id = walletId;
  }
  
  const wallets = await MultiSigWallet.find(walletQuery).select('_id');
  const walletIds = wallets.map(w => w._id);
  
  const query = { wallet: { $in: walletIds } };
  
  if (status) {
    query.status = status;
  }
  
  const transactions = await TransactionApproval.find(query)
    .populate('wallet', 'name address cryptocurrency')
    .populate('order')
    .populate('metadata.initiatedBy', 'name email')
    .populate('approvals.signer', 'name email')
    .sort('-createdAt');
  
  res.json({
    success: true,
    count: transactions.length,
    data: transactions
  });
});

/**
 * Get a specific transaction approval
 * GET /api/wallets/multi-sig/transactions/:id
 * @access Private
 */
exports.getTransactionApproval = asyncHandler(async (req, res, next) => {
  const transaction = await TransactionApproval.findById(req.params.id)
    .populate('wallet')
    .populate('order')
    .populate('metadata.initiatedBy', 'name email')
    .populate('approvals.signer', 'name email');
  
  if (!transaction) {
    return next(new AppError('Transaction not found', 404));
  }
  
  // Verify user has access to wallet
  const wallet = await MultiSigWallet.findById(transaction.wallet);
  if (!wallet.hasAccess(req.user.id)) {
    return next(new AppError('You do not have access to this transaction', 403));
  }
  
  res.json({
    success: true,
    data: transaction
  });
});

/**
 * Approve or reject a transaction
 * POST /api/wallets/multi-sig/transactions/:id/approve
 * @access Private
 */
exports.approveTransaction = asyncHandler(async (req, res, next) => {
  const { approved, signature, comment } = req.body;
  
  if (approved === undefined) {
    return next(new AppError('Approval status is required', 400));
  }
  
  const transaction = await TransactionApproval.findById(req.params.id);
  
  if (!transaction) {
    return next(new AppError('Transaction not found', 404));
  }
  
  // Check if transaction is still pending
  if (transaction.status !== 'pending') {
    return next(new AppError(`Transaction is already ${transaction.status}`, 400));
  }
  
  // Check if expired
  if (transaction.metadata.expiresAt && transaction.metadata.expiresAt < new Date()) {
    transaction.status = 'expired';
    await transaction.save();
    return next(new AppError('Transaction approval has expired', 400));
  }
  
  // Get wallet and verify user is a signer
  const wallet = await MultiSigWallet.findById(transaction.wallet);
  if (!wallet.isSigner(req.user.id)) {
    return next(new AppError('You are not authorized to approve this transaction', 403));
  }
  
  // Check if user already approved
  if (transaction.hasUserApproved(req.user.id)) {
    return next(new AppError('You have already provided approval for this transaction', 400));
  }
  
  // Add approval
  transaction.addApproval(req.user.id, approved, signature, comment);
  await transaction.save();
  
  await transaction.populate('wallet', 'name address cryptocurrency');
  await transaction.populate('order');
  await transaction.populate('metadata.initiatedBy', 'name email');
  await transaction.populate('approvals.signer', 'name email');
  
  // Enhanced security logging for approval actions
  logger.logMultiSigOperation('transaction_approval', {
    transactionId: transaction._id,
    walletId: transaction.wallet._id,
    userId: req.user.id,
    userEmail: req.user.email,
    approved,
    comment: comment || null,
    currentApprovals: transaction.approvalCount,
    requiredApprovals: transaction.requiredApprovals,
    newStatus: transaction.status,
    hasSignature: !!signature
  });
  
  res.json({
    success: true,
    data: transaction
  });
});

/**
 * Execute a transaction (after full approval)
 * POST /api/wallets/multi-sig/transactions/:id/execute
 * @access Private
 */
exports.executeTransaction = asyncHandler(async (req, res, next) => {
  const { transactionHash } = req.body;
  
  if (!transactionHash) {
    return next(new AppError('Transaction hash is required', 400));
  }
  
  const transaction = await TransactionApproval.findById(req.params.id)
    .populate('wallet')
    .populate('order');
  
  if (!transaction) {
    return next(new AppError('Transaction not found', 404));
  }
  
  // Check if transaction is approved
  if (transaction.status !== 'approved') {
    return next(new AppError('Transaction must be fully approved before execution', 400));
  }
  
  // Check if user has access
  const wallet = await MultiSigWallet.findById(transaction.wallet);
  if (!wallet.hasAccess(req.user.id)) {
    return next(new AppError('You do not have access to this transaction', 403));
  }
  
  // Check if transaction hash already used
  const existingPayment = await Payment.findOne({ transactionHash });
  if (existingPayment) {
    return next(new AppError('Transaction hash already used', 400));
  }
  
  // Verify transaction on blockchain if enabled
  let verificationResult = { verified: true };
  
  if (process.env.VERIFY_BLOCKCHAIN === 'true') {
    logger.info('Verifying multi-sig transaction on blockchain...');
    verificationResult = await verifyTransaction(
      transaction.cryptocurrency,
      transactionHash,
      transaction.toAddress,
      transaction.amount
    );
    
    if (!verificationResult.verified) {
      logger.warn(`Multi-sig transaction verification failed: ${verificationResult.error}`);
      return next(new AppError(
        `Transaction verification failed: ${verificationResult.error}`,
        400
      ));
    }
  }
  
  // Update transaction
  transaction.transactionHash = transactionHash;
  transaction.status = 'executed';
  transaction.metadata.executedAt = new Date();
  await transaction.save();
  
  // If associated with an order, create payment and update order
  if (transaction.order) {
    const order = transaction.order;
    
    // Create payment record
    await Payment.create({
      order: order._id,
      transactionHash,
      cryptocurrency: transaction.cryptocurrency,
      amount: transaction.amount,
      amountUSD: order.totalPriceUSD,
      toAddress: transaction.toAddress,
      fromAddress: transaction.fromAddress,
      status: 'confirmed',
      confirmations: verificationResult.confirmations || 0,
      blockNumber: verificationResult.blockNumber || null,
      blockHash: verificationResult.blockHash || null,
      confirmedAt: new Date(),
      verificationAttempts: 1,
      lastVerificationAt: new Date()
    });
    
    // Update order status
    order.status = 'paid';
    order.transactionHash = transactionHash;
    await order.save();
    
    logger.info(`Order ${order._id} paid via multi-sig transaction ${transaction._id}`);
  }
  
  await transaction.populate('wallet', 'name address cryptocurrency');
  await transaction.populate('order');
  await transaction.populate('metadata.initiatedBy', 'name email');
  await transaction.populate('approvals.signer', 'name email');
  
  // Enhanced security logging for transaction execution
  logger.logMultiSigOperation('transaction_executed', {
    transactionId: transaction._id,
    walletId: transaction.wallet._id,
    executedBy: req.user.id,
    executedByEmail: req.user.email,
    transactionHash,
    amount: transaction.amount,
    cryptocurrency: transaction.cryptocurrency,
    toAddress: transaction.toAddress,
    orderId: transaction.order?._id || null,
    approvalCount: transaction.approvalCount,
    verified: verificationResult.verified
  });
  
  res.json({
    success: true,
    data: transaction
  });
});

/**
 * Cancel a pending transaction
 * DELETE /api/wallets/multi-sig/transactions/:id
 * @access Private (Initiator or wallet owner only)
 */
exports.cancelTransaction = asyncHandler(async (req, res, next) => {
  const transaction = await TransactionApproval.findById(req.params.id)
    .populate('wallet');
  
  if (!transaction) {
    return next(new AppError('Transaction not found', 404));
  }
  
  // Only allow cancellation of pending transactions
  if (transaction.status !== 'pending') {
    return next(new AppError(`Cannot cancel ${transaction.status} transaction`, 400));
  }
  
  const wallet = await MultiSigWallet.findById(transaction.wallet);
  
  // Check if user is initiator or wallet owner
  const isInitiator = transaction.metadata.initiatedBy.toString() === req.user.id;
  const isOwner = wallet.owner.toString() === req.user.id;
  
  if (!isInitiator && !isOwner) {
    return next(new AppError('Only transaction initiator or wallet owner can cancel', 403));
  }
  
  transaction.status = 'rejected';
  transaction.metadata.rejectionReason = 'Cancelled by user';
  await transaction.save();
  
  logger.info(`Transaction cancelled: ${transaction._id} by user ${req.user.id}`);
  
  res.json({
    success: true,
    message: 'Transaction cancelled successfully'
  });
});
