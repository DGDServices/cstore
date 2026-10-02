const Order = require('../models/Order');
const Product = require('../models/Product');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const dgdConfig = require('../config/dgd');
const { DgdCoreClient } = require('../services/dgdCoreClient');
const { SETTLEMENT_CURRENCIES } = require('../config/cryptocurrencies');

/**
 * Orders settle in DGD only, through the non-custodial escrow at
 * /api/dgd-escrow (see docs/DGD_ESCROW_SIGNING.md). Creating an order records
 * what is being bought and how much DGD it costs at the single Explorer price;
 * it does not move funds. The buyer then opens and funds the escrow, and the
 * order's `dgdEscrowState` is the source of truth for where the money is.
 *
 * Lifecycle (order.status / order.dgdEscrowState):
 *   pending / null       order created, escrow not yet opened
 *   pending / created    escrow opened, waiting for the buyer to fund it
 *   paid    / funded     escrow funded (stock is reserved at this point)
 *   shipped              admin or seller marks shipped
 *   delivered / released buyer confirmed delivery and the payout PSBT settled
 *   refunded / refunded  cancel-refund settled
 *   disputed             open dispute; arbitrator may mediate
 */

// Same stateless client the escrow controller uses.
const dgd = new DgdCoreClient({
  baseUrl: dgdConfig.DGD_CORE_URL,
  authToken: dgdConfig.DGD_CORE_AUTH_TOKEN,
});

const escrowId = order => order.dgdEscrowId || order._id.toString();

// @desc    Create order
// @route   POST /api/orders
// @access  Private (the buyer must be a known party for the escrow)
const createOrder = asyncHandler(async (req, res, next) => {
  const { productId, quantity, customerEmail, shippingAddress } = req.body;

  if (!req.user) {
    return next(new AppError('Authentication required to place an order', 401));
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }

  if (product.stock < quantity) {
    return next(new AppError('Insufficient stock', 400));
  }

  // Prices are in DGD at the single Explorer price; USD is display only.
  const totalPrice = product.price * quantity;
  const totalPriceUSD = product.priceUSD * quantity;
  dgdConfig.assertSettlementIsDgd(dgdConfig.SETTLEMENT_ASSET);

  const order = await Order.create({
    user: req.user.id,
    customerEmail,
    items: [
      {
        product: product._id,
        productName: product.name,
        quantity,
        price: product.price,
        priceUSD: product.priceUSD,
      },
    ],
    totalPrice,
    totalPriceUSD,
    settlementAsset: dgdConfig.SETTLEMENT_ASSET,
    // Expected escrow amount in integer sats (8 dp) so the escrow can be opened
    // with the exact amount later without float drift.
    dgdExpectedSats: dgdConfig.toSats(totalPrice),
    shippingAddress,
    status: 'pending',
  });

  logger.info(`Order created: ${order._id} for ${customerEmail} (${totalPrice} DGD)`);

  res.status(201).json({
    success: true,
    data: {
      order,
      next: {
        action: 'open-escrow',
        route: `/api/dgd-escrow/${order._id}/open`,
      },
    },
  });
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Public (with order ID)
const getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('items.product', 'name image');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (req.user) {
    if (req.user.role !== 'admin' && order.user && order.user.toString() !== req.user.id) {
      return next(new AppError('Not authorized to view this order', 403));
    }
  }

  res.json({
    success: true,
    data: { order },
  });
});

// @desc    Get user orders
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user.id })
    .populate('items.product', 'name image')
    .sort('-createdAt');

  res.json({
    success: true,
    data: { orders },
  });
});

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Private/Admin
const getAllOrders = asyncHandler(async (req, res, next) => {
  const { status, escrowState, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (escrowState) query.dgdEscrowState = escrowState;

  const skip = (page - 1) * limit;
  const orders = await Order.find(query)
    .populate('user', 'name email')
    .populate('items.product', 'name image')
    .sort('-createdAt')
    .skip(skip)
    .limit(Number(limit));

  const total = await Order.countDocuments(query);

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Update order fulfilment status (admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
//
// Fulfilment only. Money states (paid / delivered-after-release / refunded)
// are set by the escrow controller when dgd-core reports them; an admin
// cannot mark an order paid or released here.
const FULFILMENT_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, trackingNumber } = req.body;

  if (!FULFILMENT_STATUSES.includes(status)) {
    return next(new AppError(`Status must be one of: ${FULFILMENT_STATUSES.join(', ')}`, 400));
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (status === 'cancelled' && ['funded', 'released', 'disputed'].includes(order.dgdEscrowState)) {
    return next(
      new AppError(
        'Order has a live escrow; use the escrow refund/dispute flow instead of cancelling',
        409
      )
    );
  }

  order.status = status;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  await order.save();

  logger.info(`Order ${order._id} status updated to ${status} by admin ${req.user.email}`);

  res.json({
    success: true,
    data: { order },
  });
});

// @desc    Buyer confirms delivery and proposes release of the escrow
// @route   POST /api/orders/:id/confirm-delivery
// @access  Private (buyer)
//
// Confirming delivery proposes the payout to the seller in dgd-core as the
// buyer. Funds move only once the payout PSBT carries the threshold
// signatures (buyer + seller, or arbitrator), produced in the parties' own
// wallets via /api/dgd-escrow/:id/sign-payout. The platform signs nothing.
const confirmDelivery = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!order.user || order.user.toString() !== req.user.id) {
    return next(new AppError('Not authorized to confirm this order', 403));
  }

  if (order.dgdEscrowState !== 'funded') {
    return next(new AppError('Escrow must be funded before delivery can be confirmed', 409));
  }

  const idempotencyKey = `confirm-delivery:${order._id}`;
  const escrow = await dgd.proposeRelease(escrowId(order), 'buyer', undefined, idempotencyKey);

  order.deliveryConfirmedAt = new Date();
  if (escrow?.state) order.dgdEscrowState = escrow.state;
  await order.save();

  logger.info(
    `Delivery confirmed for order ${order._id} by buyer ${req.user.id}; release proposed`
  );

  res.json({
    success: true,
    data: {
      order,
      escrow,
      next: {
        action: 'sign-payout',
        route: `/api/dgd-escrow/${order._id}/payout-psbt`,
      },
    },
  });
});

// @desc    Get the settlement currency (DGD only)
// @route   GET /api/cryptocurrencies
// @access  Public
const getCryptocurrencies = asyncHandler(async (req, res, next) => {
  res.json({
    success: true,
    data: { cryptocurrencies: SETTLEMENT_CURRENCIES },
  });
});

module.exports = {
  createOrder,
  getOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  confirmDelivery,
  getCryptocurrencies,
};
