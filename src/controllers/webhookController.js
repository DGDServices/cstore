const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// @desc    Handle payment webhook
// @route   POST /api/webhooks/payment
// @access  Webhook (authenticated via signature)
const handlePaymentWebhook = asyncHandler(async (req, res) => {
  const { 
    transaction_hash, 
    payment_id, 
    confirmations, 
    status
  } = req.body;

  logger.info('Payment webhook received:', {
    payment_id,
    transaction_hash,
    status,
    confirmations
  });

  // Validate required fields
  if (!payment_id || !status) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }

  // Find payment by ID
  const payment = await Payment.findById(payment_id);
  
  if (!payment) {
    logger.warn(`Payment not found: ${payment_id}`);
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  // Update payment status
  const oldStatus = payment.status;
  payment.status = status;
  
  if (transaction_hash) {
    payment.transactionHash = transaction_hash;
  }
  
  if (confirmations !== undefined) {
    payment.confirmations = confirmations;
  }

  await payment.save();

  // Update order status if payment is confirmed
  if (status === 'confirmed' && oldStatus !== 'confirmed') {
    const order = await Order.findById(payment.order);
    if (order && order.status === 'pending') {
      order.status = 'processing';
      order.paymentStatus = 'paid';
      await order.save();
      
      logger.info(`Order ${order._id} status updated to processing`);
    }
  }

  logger.info(`Payment ${payment_id} status updated: ${oldStatus} -> ${status}`);

  res.json({
    success: true,
    message: 'Payment webhook processed successfully'
  });
});

// @desc    Handle transaction webhook
// @route   POST /api/webhooks/transaction
// @access  Webhook (authenticated via signature)
const handleTransactionWebhook = asyncHandler(async (req, res) => {
  const { 
    transaction_hash, 
    currency,
    confirmations
  } = req.body;

  logger.info('Transaction webhook received:', {
    transaction_hash,
    currency,
    confirmations
  });

  // Validate required fields
  if (!transaction_hash || !currency) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }

  // Find payment by transaction hash
  const payment = await Payment.findOne({ transactionHash: transaction_hash });
  
  if (!payment) {
    logger.warn(`Payment not found for transaction: ${transaction_hash}`);
    // This might be a new transaction, just acknowledge it
    return res.json({
      success: true,
      message: 'Transaction acknowledged (no matching payment)'
    });
  }

  // Update confirmations
  if (confirmations !== undefined) {
    payment.confirmations = confirmations;
    
    // Mark as confirmed if reached required confirmations
    const requiredConfirmations = getRequiredConfirmations(currency);
    if (confirmations >= requiredConfirmations && payment.status !== 'confirmed') {
      payment.status = 'confirmed';
      
      // Update order
      const order = await Order.findById(payment.order);
      if (order && order.status === 'pending') {
        order.status = 'processing';
        order.paymentStatus = 'paid';
        await order.save();
      }
    }
  }

  await payment.save();

  logger.info(`Transaction ${transaction_hash} processed: ${confirmations} confirmations`);

  res.json({
    success: true,
    message: 'Transaction webhook processed successfully'
  });
});

// @desc    Handle blockchain event webhook
// @route   POST /api/webhooks/blockchain
// @access  Webhook (authenticated via signature)
const handleBlockchainWebhook = asyncHandler(async (req, res) => {
  const { event_type, data } = req.body;

  logger.info('Blockchain webhook received:', {
    event_type,
    data: data ? Object.keys(data) : []
  });

  // Process different blockchain events
  switch (event_type) {
    case 'new_block':
      // Handle new block event
      logger.info('New block event:', data);
      break;
      
    case 'address_activity':
      // Handle address activity
      logger.info('Address activity:', data);
      break;
      
    case 'contract_event':
      // Handle smart contract event
      logger.info('Contract event:', data);
      break;
      
    default:
      logger.warn(`Unknown blockchain event type: ${event_type}`);
  }

  res.json({
    success: true,
    message: 'Blockchain webhook processed successfully'
  });
});

/**
 * Get required confirmations for a cryptocurrency
 * @param {string} currency - Currency symbol
 * @returns {number} - Required confirmations
 */
const getRequiredConfirmations = (currency) => {
  const confirmations = {
    BTC: 6,
    ETH: 12,
    LTC: 6,
    USDT: 12,
    XRP: 1
  };
  
  return confirmations[currency.toUpperCase()] || 6;
};

module.exports = {
  handlePaymentWebhook,
  handleTransactionWebhook,
  handleBlockchainWebhook
};
