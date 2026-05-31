const lightningService = require('../services/lightningService');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const LightningInvoice = require('../models/LightningInvoice');
const { AppError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const QRCode = require('qrcode');

/**
 * Get Lightning Network status and info
 * @route GET /api/lightning/info
 * @access Public
 */
exports.getLightningInfo = asyncHandler(async (req, res, next) => {
  if (!lightningService.isLndAvailable()) {
    return res.status(200).json({
      success: true,
      data: {
        available: false,
        message: 'Lightning Network is not configured or unavailable'
      }
    });
  }

  const info = await lightningService.getWalletInfo();
  const balance = await lightningService.getBalance();

  res.status(200).json({
    success: true,
    data: {
      available: true,
      info,
      balance
    }
  });
});

/**
 * Create Lightning invoice for order
 * @route POST /api/lightning/invoices
 * @access Public
 */
exports.createInvoice = asyncHandler(async (req, res, next) => {
  const { orderId, expireSeconds } = req.body;

  if (!lightningService.isLndAvailable()) {
    return next(new AppError('Lightning Network is not available', 503));
  }

  // Get order
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order already has a pending Lightning invoice
  const existingInvoice = await LightningInvoice.findOne({
    order: orderId,
    status: { $in: ['pending', 'paid'] }
  });

  if (existingInvoice) {
    if (existingInvoice.status === 'paid') {
      return next(new AppError('Order already has a paid Lightning invoice', 400));
    }
    
    // Check if existing invoice is expired
    if (!existingInvoice.checkExpiration()) {
      // Return existing pending invoice
      return res.status(200).json({
        success: true,
        data: {
          invoice: {
            paymentRequest: existingInvoice.paymentRequest,
            paymentHash: existingInvoice.paymentHash,
            amount: existingInvoice.amount,
            amountMsat: existingInvoice.amountMsat,
            description: existingInvoice.description,
            expiresAt: existingInvoice.expiresAt,
            createdAt: existingInvoice.createdAt
          }
        }
      });
    }
    
    // Mark expired invoice as expired
    await existingInvoice.save();
  }

  // Get cryptocurrency price in BTC
  const blockchainService = require('../services/blockchainService');
  const btcPrice = await blockchainService.getCryptoPrice('BTC');
  
  // Calculate amount in satoshis
  const amountBTC = order.totalPriceUSD / btcPrice;
  const amountSatoshis = Math.floor(amountBTC * 100000000);

  // Create invoice
  const invoice = await lightningService.createInvoice({
    amount: amountSatoshis,
    description: `Order #${order._id.toString().substring(0, 8)} - ${order.items.length} item(s)`,
    expireSeconds: expireSeconds || 3600,
    orderId: order._id,
    amountUSD: order.totalPriceUSD
  });

  logger.info(`Lightning invoice created for order ${orderId}: ${invoice.paymentHash}`);

  // Generate QR code for the payment request
  let qrCodeDataUrl = null;
  try {
    qrCodeDataUrl = await QRCode.toDataURL(invoice.paymentRequest, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2
    });
  } catch (qrError) {
    logger.warn('Failed to generate QR code:', qrError);
    // Continue without QR code - not critical
  }

  res.status(201).json({
    success: true,
    data: { 
      invoice: {
        ...invoice,
        qrCode: qrCodeDataUrl
      }
    }
  });
});

/**
 * Get invoice status
 * @route GET /api/lightning/invoices/:paymentHash
 * @access Public
 */
exports.getInvoiceStatus = asyncHandler(async (req, res, next) => {
  const { paymentHash } = req.params;

  if (!lightningService.isLndAvailable()) {
    return next(new AppError('Lightning Network is not available', 503));
  }

  const status = await lightningService.getInvoiceStatus(paymentHash);

  res.status(200).json({
    success: true,
    data: { status }
  });
});

/**
 * Confirm Lightning payment and update order
 * @route POST /api/lightning/payments/confirm
 * @access Public
 */
exports.confirmPayment = asyncHandler(async (req, res, next) => {
  const { paymentHash } = req.body;

  if (!lightningService.isLndAvailable()) {
    return next(new AppError('Lightning Network is not available', 503));
  }

  // Get invoice from database
  const invoice = await LightningInvoice.findOne({ paymentHash }).populate('order');
  if (!invoice) {
    return next(new AppError('Invoice not found', 404));
  }

  // Check payment status with LND
  const status = await lightningService.getInvoiceStatus(paymentHash);

  if (status.status !== 'paid') {
    return res.status(200).json({
      success: false,
      message: 'Payment not confirmed yet',
      data: { status: status.status }
    });
  }

  // Check if payment already processed
  const existingPayment = await Payment.findOne({ transactionHash: paymentHash });
  if (existingPayment) {
    return res.status(200).json({
      success: true,
      message: 'Payment already confirmed',
      data: {
        payment: existingPayment,
        order: invoice.order
      }
    });
  }

  // Create payment record
  const payment = new Payment({
    order: invoice.order._id,
    transactionHash: paymentHash,
    cryptocurrency: 'BTC-LN', // Lightning Network Bitcoin
    amount: invoice.amount / 100000000, // Convert satoshis to BTC
    amountUSD: invoice.amountUSD,
    fromAddress: 'Lightning Network',
    toAddress: 'Lightning Network',
    status: 'confirmed',
    confirmations: 1,
    confirmedAt: status.paidAt
  });

  await payment.save();

  // Update order status
  const order = invoice.order;
  order.status = 'paid';
  order.paymentMethod = 'Lightning Network';
  order.paidAt = status.paidAt;
  
  // Update product stock
  const Product = require('../models/Product');
  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock -= item.quantity;
      product.sold += item.quantity;
      await product.save();
    }
  }
  
  await order.save();

  logger.info(`Lightning payment confirmed for order ${order._id}: ${paymentHash}`);

  res.status(200).json({
    success: true,
    message: 'Payment confirmed successfully',
    data: {
      payment,
      order
    }
  });
});

/**
 * Decode Lightning payment request
 * @route POST /api/lightning/decode
 * @access Public
 */
exports.decodePaymentRequest = asyncHandler(async (req, res, next) => {
  const { paymentRequest } = req.body;

  if (!lightningService.isLndAvailable()) {
    return next(new AppError('Lightning Network is not available', 503));
  }

  const decoded = await lightningService.decodePaymentRequest(paymentRequest);

  res.status(200).json({
    success: true,
    data: { decoded }
  });
});

/**
 * List all Lightning channels
 * @route GET /api/lightning/channels
 * @access Private/Admin
 */
exports.listChannels = asyncHandler(async (req, res, next) => {
  if (!lightningService.isLndAvailable()) {
    return next(new AppError('Lightning Network is not available', 503));
  }

  const channels = await lightningService.listChannels();

  res.status(200).json({
    success: true,
    data: {
      channels,
      count: channels.length
    }
  });
});

/**
 * Open a new Lightning channel
 * @route POST /api/lightning/channels
 * @access Private/Admin
 */
exports.openChannel = asyncHandler(async (req, res, next) => {
  const { publicKey, localAmount, isPrivate } = req.body;

  if (!lightningService.isLndAvailable()) {
    return next(new AppError('Lightning Network is not available', 503));
  }

  const result = await lightningService.openChannel({
    publicKey,
    localAmount,
    isPrivate: isPrivate || false
  });

  logger.info(`Lightning channel opened: ${result.channelId}`);

  res.status(201).json({
    success: true,
    message: 'Channel opening initiated',
    data: result
  });
});

/**
 * Close a Lightning channel
 * @route DELETE /api/lightning/channels/:channelId
 * @access Private/Admin
 */
exports.closeChannel = asyncHandler(async (req, res, next) => {
  const { channelId } = req.params;
  const { force } = req.query;

  if (!lightningService.isLndAvailable()) {
    return next(new AppError('Lightning Network is not available', 503));
  }

  const result = await lightningService.closeChannel(channelId, force === 'true');

  logger.info(`Lightning channel ${force === 'true' ? 'force ' : ''}closed: ${channelId}`);

  res.status(200).json({
    success: true,
    message: `Channel ${force === 'true' ? 'force ' : ''}closing initiated`,
    data: result
  });
});

/**
 * Get Lightning wallet balance
 * @route GET /api/lightning/balance
 * @access Private/Admin
 */
exports.getBalance = asyncHandler(async (req, res, next) => {
  if (!lightningService.isLndAvailable()) {
    return next(new AppError('Lightning Network is not available', 503));
  }

  const balance = await lightningService.getBalance();

  res.status(200).json({
    success: true,
    data: { balance }
  });
});

/**
 * Pay a Lightning invoice
 * @route POST /api/lightning/pay
 * @access Private/Admin
 */
exports.payInvoice = asyncHandler(async (req, res, next) => {
  const { paymentRequest, maxFee } = req.body;

  if (!lightningService.isLndAvailable()) {
    return next(new AppError('Lightning Network is not available', 503));
  }

  const result = await lightningService.payInvoice(paymentRequest, maxFee);

  logger.info(`Lightning invoice paid: ${result.paymentHash}`);

  res.status(200).json({
    success: true,
    message: 'Invoice paid successfully',
    data: result
  });
});
