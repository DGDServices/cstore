const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Escrow = require('../models/Escrow');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const currencyService = require('../services/currencyService');
const escrowService = require('../services/escrowService');
const { ALL_SUPPORTED_CRYPTOCURRENCIES } = require('../config/cryptocurrencies');

// Supported cryptocurrencies with addresses
const cryptoAddressFallbacks = {
  BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  ETH: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  USDT: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  LTC: 'ltc-address-not-configured',
  XRP: 'xrp-address-not-configured',
  'BTC-LN': 'Lightning Network'
};

const supportedCryptos = ALL_SUPPORTED_CRYPTOCURRENCIES.map((coin) => {
  const envKey = `${coin.symbol.replace(/-/g, '_')}_ADDRESS`;
  return {
    symbol: coin.symbol,
    name: coin.name,
    address: process.env[envKey] || cryptoAddressFallbacks[coin.symbol] || 'Not configured'
  };
});

const getEscrowDepositAddress = (cryptocurrency, fallbackAddress) => {
  const envKey = `ESCROW_${cryptocurrency.replace(/-/g, '_')}_ADDRESS`;
  return process.env[envKey] || process.env.ESCROW_DEPOSIT_ADDRESS || fallbackAddress;
};

const getDefaultSellerId = async (product) => {
  if (product.seller) {
    return product.seller;
  }

  if (process.env.DEFAULT_PLATFORM_SELLER_ID) {
    return process.env.DEFAULT_PLATFORM_SELLER_ID;
  }

  const adminUser = await User.findOne({ role: 'admin' }).select('_id');
  if (adminUser) {
    return adminUser._id;
  }

  return null;
};

const markDeliveryConditionMet = (escrow) => {
  if (!escrow || !Array.isArray(escrow.releaseConditions)) {
    return false;
  }

  const deliveryCondition = escrow.releaseConditions.find(
    condition => condition.type === 'delivery_confirmation'
  );

  if (!deliveryCondition || deliveryCondition.met) {
    return false;
  }

  deliveryCondition.met = true;
  deliveryCondition.metAt = new Date();
  return true;
};

// @desc    Create order
// @route   POST /api/orders
// @access  Private (required for escrow buyer linkage)
const createOrder = asyncHandler(async (req, res, next) => {
  const { productId, quantity, customerEmail, cryptocurrency, shippingAddress, displayCurrency } = req.body;

  if (!req.user) {
    return next(new AppError('Authentication required for escrow orders', 401));
  }

  // Get product
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }

  // Check stock
  if (product.stock < quantity) {
    return next(new AppError('Insufficient stock', 400));
  }

  // Get crypto address
  const crypto = supportedCryptos.find(c => c.symbol === cryptocurrency);
  if (!crypto) {
    return next(new AppError('Unsupported cryptocurrency', 400));
  }
  if (!crypto.address || crypto.address === 'Not configured') {
    return next(new AppError(`Payment address not configured for ${cryptocurrency}`, 503));
  }

  // Calculate prices
  const totalPriceUSD = product.priceUSD * quantity;
  let displayPrice = totalPriceUSD;
  let exchangeRate = 1;
  let orderCurrency = displayCurrency || 'USD';

  // Convert to user's preferred currency if specified
  if (displayCurrency && displayCurrency.toUpperCase() !== 'USD') {
    try {
      const conversion = await currencyService.convertCurrency(
        totalPriceUSD,
        'USD',
        displayCurrency.toUpperCase()
      );
      displayPrice = conversion.convertedAmount;
      exchangeRate = conversion.exchangeRate;
      orderCurrency = displayCurrency.toUpperCase();
    } catch (error) {
      logger.warn(`Currency conversion failed during order creation: ${error.message}`);
      // Continue with USD if conversion fails
      orderCurrency = 'USD';
    }
  }

  const depositAddress = getEscrowDepositAddress(cryptocurrency, crypto.address);

  // Create order
  const order = await Order.create({
    user: req.user ? req.user.id : null,
    customerEmail,
    items: [{
      product: product._id,
      productName: product.name,
      quantity,
      price: product.price,
      priceUSD: product.priceUSD
    }],
    totalPrice: product.price * quantity,
    totalPriceUSD,
    displayCurrency: orderCurrency,
    displayPrice,
    exchangeRate,
    cryptocurrency,
    paymentAddress: depositAddress,
    shippingAddress,
    status: 'pending'
  });

  try {
    const sellerId = await getDefaultSellerId(product);
    if (!sellerId) {
      throw new Error('No seller configured for product');
    }

    const escrow = await escrowService.createEscrow({
      buyer: req.user.id,
      seller: sellerId,
      order: order._id,
      title: `Order ${order._id}`,
      description: `Escrow for order ${order._id}`,
      amount: order.totalPrice,
      cryptocurrency,
      amountUSD: order.totalPriceUSD,
      depositAddress,
      releaseType: 'manual',
      releaseConditions: [
        {
          type: 'delivery_confirmation',
          value: true
        }
      ],
      metadata: {
        orderSource: 'orderController'
      }
    }, req.user.id);

    order.escrow = escrow._id;
    await order.save();
  } catch (error) {
    await Order.findByIdAndDelete(order._id);
    logger.error(`Failed to create escrow for order ${order._id}: ${error.message}`);
    return next(new AppError('Failed to create escrow for order', 500));
  }

  logger.info(`Order created: ${order._id} for ${customerEmail}`);

  res.status(201).json({
    success: true,
    data: { order }
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

  // Check if user is authorized to view this order
  if (req.user) {
    if (req.user.role !== 'admin' && order.user && order.user.toString() !== req.user.id) {
      return next(new AppError('Not authorized to view this order', 403));
    }
  }

  res.json({
    success: true,
    data: { order }
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
    data: { orders }
  });
});

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Private/Admin
const getAllOrders = asyncHandler(async (req, res, next) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) query.status = status;

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
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Update order status (admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  order.status = status;
  await order.save();

  if (status === 'delivered' && order.escrow) {
    const escrow = await Escrow.findById(order.escrow);
    if (escrow && markDeliveryConditionMet(escrow)) {
      await escrow.save();
    }
  }

  logger.info(`Order ${order._id} status updated to ${status} by admin ${req.user.email}`);

  res.json({
    success: true,
    data: { order }
  });
});

// @desc    Buyer confirms delivery and releases escrow
// @route   POST /api/orders/:id/confirm-delivery
// @access  Private
const confirmDelivery = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!order.user) {
    return next(new AppError('This order has no associated user and cannot be confirmed', 400));
  }

  if (order.user.toString() !== req.user.id) {
    return next(new AppError('Not authorized to confirm this order', 403));
  }

  if (order.status !== 'delivered') {
    return next(new AppError('Order must be delivered before confirmation', 400));
  }

  if (!order.escrow) {
    return next(new AppError('Escrow not found for this order', 404));
  }

  const escrow = await Escrow.findById(order.escrow);
  if (!escrow) {
    return next(new AppError('Escrow not found for this order', 404));
  }

  if (markDeliveryConditionMet(escrow)) {
    await escrow.save();
  }

  const releaseResult = await escrowService.releaseEscrow(order.escrow, req.user.id);

  logger.info(`Delivery confirmed for order ${order._id} by user ${req.user.id}`);

  res.json({
    success: true,
    data: {
      order,
      escrow: releaseResult.escrow,
      releaseStatus: releaseResult.status
    }
  });
});

// @desc    Get supported cryptocurrencies
// @route   GET /api/cryptocurrencies
// @access  Public
const getCryptocurrencies = asyncHandler(async (req, res, next) => {
  res.json({
    success: true,
    data: { cryptocurrencies: supportedCryptos }
  });
});

module.exports = {
  createOrder,
  getOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  confirmDelivery,
  getCryptocurrencies
};
