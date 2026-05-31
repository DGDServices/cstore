const Payment = require('../models/Payment');
const Order = require('../models/Order');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { verifyTransaction } = require('../services/blockchainService');
const escrowService = require('../services/escrowService');
const transactionMonitoring = require('../services/transactionMonitoring');
const kycService = require('../services/kyc');
const sanctionsService = require('../services/sanctions');

const runEscrowFundingComplianceChecks = async (order, payment) => {
  if (!order.user) {
    logger.warn(`Skipping escrow compliance checks for order ${order._id}: missing order.user`);
    return {
      approved: false,
      checksSkipped: true,
      reason: 'Order has no associated user for compliance checks'
    };
  }

  const user = await User.findById(order.user).select('name country createdAt');
  if (!user) {
    throw new Error('Order user not found for compliance checks');
  }

  const kycStatus = await kycService.checkVerificationStatus(user._id);
  const sanctionsResult = await sanctionsService.screenUser(user._id, {
    name: user.name,
    country: user.country
  });
  const monitoringResult = await transactionMonitoring.monitorBeforeTransaction({
    _id: payment._id,
    user: user._id,
    fiatAmount: payment.amountUSD,
    amount: payment.amount,
    cryptocurrency: payment.cryptocurrency,
    transactionHash: payment.transactionHash
  }, user);

  return {
    approved: monitoringResult.approved && sanctionsResult.action !== 'block',
    requiresManualReview: monitoringResult.requiresManualReview || sanctionsResult.action === 'manual_review' || !kycStatus.verified,
    kycStatus,
    sanctionsResult,
    monitoringResult
  };
};

// @desc    Confirm payment
// @route   POST /api/payments/confirm
// @access  Public
const confirmPayment = asyncHandler(async (req, res, next) => {
  const { orderId, transactionHash } = req.body;

  // Find order
  const order = await Order.findById(orderId).populate('items.product');
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order is already paid
  if (order.status === 'paid' || order.status === 'processing') {
    return next(new AppError('Order already paid', 400));
  }

  // Check if transaction hash already exists
  const existingPayment = await Payment.findOne({ transactionHash });
  if (existingPayment) {
    return next(new AppError('Transaction hash already used', 400));
  }

  // Verify transaction on blockchain (optional in demo mode)
  let verificationResult = { verified: true }; // Default for demo
  
  if (process.env.VERIFY_BLOCKCHAIN === 'true') {
    logger.info('Verifying transaction on blockchain...');
    verificationResult = await verifyTransaction(
      order.cryptocurrency,
      transactionHash,
      order.paymentAddress,
      order.totalPrice
    );

    if (!verificationResult.verified) {
      logger.warn(`Transaction verification failed: ${verificationResult.error}`);
      
      // Create payment record with failed status
      await Payment.create({
        order: order._id,
        transactionHash,
        cryptocurrency: order.cryptocurrency,
        amount: order.totalPrice,
        amountUSD: order.totalPriceUSD,
        toAddress: order.paymentAddress,
        fromAddress: verificationResult.fromAddress || null,
        status: 'failed',
        confirmations: verificationResult.confirmations || 0,
        blockNumber: verificationResult.blockNumber || null,
        blockHash: verificationResult.blockHash || null,
        verificationAttempts: 1,
        lastVerificationAt: new Date()
      });

      return next(new AppError(
        `Payment verification failed: ${verificationResult.error}`,
        400
      ));
    }
  }

  // Create payment record
  const payment = await Payment.create({
    order: order._id,
    transactionHash,
    cryptocurrency: order.cryptocurrency,
    amount: verificationResult.amount || order.totalPrice,
    amountUSD: order.totalPriceUSD,
    toAddress: order.paymentAddress,
    fromAddress: verificationResult.fromAddress || null,
    status: 'confirmed',
    confirmations: verificationResult.confirmations || 0,
    blockNumber: verificationResult.blockNumber || null,
    blockHash: verificationResult.blockHash || null,
    confirmedAt: new Date(),
    verificationAttempts: 1,
    lastVerificationAt: new Date()
  });

  if (!order.escrow) {
    payment.status = 'failed';
    await payment.save();
    return next(new AppError('Escrow not found for order', 400));
  }

  const complianceResult = await runEscrowFundingComplianceChecks(order, payment);
  if (!complianceResult.approved) {
    payment.status = 'failed';
    await payment.save();
    return next(new AppError(`Payment blocked by compliance checks: ${complianceResult.reason || 'monitoring or sanctions rules'}`, 400));
  }

  try {
    await escrowService.fundEscrow(order.escrow, transactionHash, order.user || null);
  } catch (error) {
    payment.status = 'failed';
    await payment.save();
    return next(new AppError(`Escrow funding failed: ${error.message}`, 400));
  }

  // Update order
  order.status = 'paid';
  order.transactionHash = transactionHash;
  await order.save();

  // Update product stock
  for (const item of order.items) {
    if (item.product) {
      item.product.stock -= item.quantity;
      await item.product.save();
    }
  }

  logger.info(`Payment confirmed for order ${order._id}: ${transactionHash}`);

  res.json({
    success: true,
    data: {
      payment,
      order,
      compliance: complianceResult,
      verification: verificationResult.verified ? {
        verified: true,
        confirmations: verificationResult.confirmations,
        blockNumber: verificationResult.blockNumber
      } : undefined
    }
  });
});

// @desc    Get payment by order ID
// @route   GET /api/payments/order/:orderId
// @access  Public (with order ID)
const getPaymentByOrder = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findOne({ order: req.params.orderId });

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  res.json({
    success: true,
    data: { payment }
  });
});

// @desc    Get all payments (admin)
// @route   GET /api/payments
// @access  Private/Admin
const getAllPayments = asyncHandler(async (req, res, next) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) query.status = status;

  const skip = (page - 1) * limit;
  const payments = await Payment.find(query)
    .populate({
      path: 'order',
      populate: { path: 'user', select: 'name email' }
    })
    .sort('-createdAt')
    .skip(skip)
    .limit(Number(limit));

  const total = await Payment.countDocuments(query);

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Verify payment manually (admin)
// @route   POST /api/payments/:id/verify
// @access  Private/Admin
const verifyPayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id).populate('order');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  if (payment.status === 'confirmed') {
    return res.json({
      success: true,
      message: 'Payment already confirmed',
      data: { payment }
    });
  }

  // Verify transaction on blockchain
  const verificationResult = await verifyTransaction(
    payment.cryptocurrency,
    payment.transactionHash,
    payment.toAddress,
    payment.amount
  );

  // Update payment
  payment.status = verificationResult.verified ? 'confirmed' : 'failed';
  payment.confirmations = verificationResult.confirmations || 0;
  payment.blockNumber = verificationResult.blockNumber || null;
  payment.blockHash = verificationResult.blockHash || null;
  payment.fromAddress = verificationResult.fromAddress || payment.fromAddress;
  payment.verificationAttempts += 1;
  payment.lastVerificationAt = new Date();
  
  if (verificationResult.verified) {
    payment.confirmedAt = new Date();
  }

  await payment.save();

  // Update order if payment is confirmed
  if (verificationResult.verified && payment.order) {
    if (!payment.order.escrow) {
      return next(new AppError('Escrow not found for order', 400));
    }

    const complianceResult = await runEscrowFundingComplianceChecks(payment.order, payment);
    if (!complianceResult.approved) {
      payment.status = 'failed';
      await payment.save();
      return next(new AppError(`Payment blocked by compliance checks: ${complianceResult.reason || 'monitoring or sanctions rules'}`, 400));
    }

    try {
      await escrowService.fundEscrow(
        payment.order.escrow,
        payment.transactionHash,
        payment.order.user || (req.user ? req.user.id : null)
      );
    } catch (error) {
      payment.status = 'failed';
      await payment.save();
      return next(new AppError(`Escrow funding failed: ${error.message}`, 400));
    }

    payment.order.status = 'paid';
    await payment.order.save();
  }

  logger.info(`Payment ${payment._id} verified by admin ${req.user.email}: ${verificationResult.verified}`);

  res.json({
    success: true,
    data: {
      payment,
      verification: verificationResult
    }
  });
});

module.exports = {
  confirmPayment,
  getPaymentByOrder,
  getAllPayments,
  verifyPayment
};
