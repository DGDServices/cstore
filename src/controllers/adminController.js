const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const MultiSigWallet = require('../models/MultiSigWallet');
const TransactionApproval = require('../models/TransactionApproval');
const logger = require('../utils/logger');
const { verifyEmailConfig } = require('../services/emailService');
const {
  exportProductsToCSV,
  exportOrdersToCSV,
  exportUsersToCSV,
  exportProductsToPDF,
  exportOrdersToPDF
} = require('../services/exportService');
const fs = require('fs');

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard/stats
 * @access Private (Admin)
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const dateQuery = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // Get counts
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingOrders,
      confirmedOrders,
      activeProducts,
      totalReviews
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(dateQuery),
      Order.aggregate([
        { $match: { status: 'confirmed', ...dateQuery } },
        { $group: { _id: null, total: { $sum: '$totalPriceUSD' } } }
      ]),
      Order.countDocuments({ status: 'pending', ...dateQuery }),
      Order.countDocuments({ status: 'confirmed', ...dateQuery }),
      Product.countDocuments({ isActive: true }),
      Review.countDocuments(dateQuery)
    ]);

    // Get recent orders
    const recentOrders = await Order.find(dateQuery)
      .sort('-createdAt')
      .limit(5)
      .populate('user', 'name email')
      .select('orderNumber totalPriceUSD cryptocurrency status createdAt');

    // Get top products
    const topProducts = await Order.aggregate([
      { $match: { status: 'confirmed', ...dateQuery } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.priceUSD'] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          totalSold: 1,
          revenue: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalProducts,
          activeProducts,
          totalOrders,
          pendingOrders,
          confirmedOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          totalReviews
        },
        recentOrders,
        topProducts
      }
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    next(error);
  }
};

/**
 * Get all users with pagination
 * GET /api/admin/users
 * @access Private (Admin)
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    next(error);
  }
};

/**
 * Get user details
 * GET /api/admin/users/:id
 * @access Private (Admin)
 */
exports.getUserDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's order history
    const orders = await Order.find({ user: user._id })
      .sort('-createdAt')
      .limit(10)
      .select('orderNumber totalPriceUSD status createdAt');

    // Get user's review count
    const reviewCount = await Review.countDocuments({ user: user._id });

    res.json({
      success: true,
      data: {
        user,
        orders,
        reviewCount
      }
    });
  } catch (error) {
    logger.error('Get user details error:', error);
    next(error);
  }
};

/**
 * Update user role
 * PUT /api/admin/users/:id/role
 * @access Private (Admin)
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "user" or "admin"'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info(`User role updated: ${user._id} to ${role} by ${req.user.id}`);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Update user role error:', error);
    next(error);
  }
};

/**
 * Delete user
 * DELETE /api/admin/users/:id
 * @access Private (Admin)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting self
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    await user.deleteOne();

    logger.info(`User deleted: ${req.params.id} by ${req.user.id}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    next(error);
  }
};

/**
 * Get sales analytics
 * GET /api/admin/analytics/sales
 * @access Private (Admin)
 */
exports.getSalesAnalytics = async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Sales by date
    const salesByDate = await Order.aggregate([
      {
        $match: {
          status: 'confirmed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalPriceUSD' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Sales by cryptocurrency
    const salesByCrypto = await Order.aggregate([
      {
        $match: {
          status: 'confirmed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$cryptocurrency',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalPriceUSD' }
        }
      }
    ]);

    // Average order value
    const avgOrderValue = await Order.aggregate([
      {
        $match: {
          status: 'confirmed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          avgValue: { $avg: '$totalPriceUSD' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period,
        salesByDate,
        salesByCrypto,
        averageOrderValue: avgOrderValue[0]?.avgValue || 0
      }
    });
  } catch (error) {
    logger.error('Get sales analytics error:', error);
    next(error);
  }
};

/**
 * Get product analytics
 * GET /api/admin/analytics/products
 * @access Private (Admin)
 */
exports.getProductAnalytics = async (req, res, next) => {
  try {
    // Low stock products
    const lowStockProducts = await Product.find({ 
      stock: { $lte: 10, $gt: 0 },
      isActive: true 
    })
      .select('name stock price')
      .sort('stock')
      .limit(10);

    // Out of stock products
    const outOfStockProducts = await Product.find({ 
      stock: 0,
      isActive: true 
    })
      .select('name price')
      .limit(10);

    // Most reviewed products
    const mostReviewedProducts = await Review.aggregate([
      { $match: { isApproved: true } },
      {
        $group: {
          _id: '$product',
          reviewCount: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      },
      { $sort: { reviewCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          reviewCount: 1,
          avgRating: { $round: ['$avgRating', 1] }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        lowStockProducts,
        outOfStockProducts,
        mostReviewedProducts
      }
    });
  } catch (error) {
    logger.error('Get product analytics error:', error);
    next(error);
  }
};

/**
 * Get system health
 * GET /api/admin/system/health
 * @access Private (Admin)
 */
exports.getSystemHealth = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    
    // Database status
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Email service status
    const emailStatus = await verifyEmailConfig() ? 'configured' : 'not configured';
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    
    // System uptime
    const uptime = process.uptime();

    res.json({
      success: true,
      data: {
        database: {
          status: dbStatus,
          name: mongoose.connection.name
        },
        email: {
          status: emailStatus
        },
        system: {
          uptime: Math.floor(uptime),
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
          },
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development'
        }
      }
    });
  } catch (error) {
    logger.error('Get system health error:', error);
    next(error);
  }
};

/**
 * Get pending reviews for moderation
 * GET /api/admin/reviews/pending
 * @access Private (Admin)
 */
exports.getPendingReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const reviews = await Review.find({ isApproved: false })
      .populate('user', 'name email')
      .populate('product', 'name image')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Review.countDocuments({ isApproved: false });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Get pending reviews error:', error);
    next(error);
  }
};

/**
 * Get recent activity log
 * GET /api/admin/activity
 * @access Private (Admin)
 */
exports.getActivityLog = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;

    // Get recent orders
    const recentOrders = await Order.find()
      .sort('-createdAt')
      .limit(limit)
      .populate('user', 'name email')
      .select('orderNumber status totalPriceUSD createdAt user');

    // Get recent reviews
    const recentReviews = await Review.find()
      .sort('-createdAt')
      .limit(limit)
      .populate('user', 'name')
      .populate('product', 'name')
      .select('rating product user createdAt');

    // Get recent user registrations
    const recentUsers = await User.find()
      .sort('-createdAt')
      .limit(limit)
      .select('name email createdAt');

    // Combine and sort by date
    const activities = [
      ...recentOrders.map(o => ({
        type: 'order',
        timestamp: o.createdAt,
        data: o
      })),
      ...recentReviews.map(r => ({
        type: 'review',
        timestamp: r.createdAt,
        data: r
      })),
      ...recentUsers.map(u => ({
        type: 'user_registration',
        timestamp: u.createdAt,
        data: u
      }))
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    logger.error('Get activity log error:', error);
    next(error);
  }
};

/**
 * Get all multi-sig wallets (Admin)
 * GET /api/admin/multi-sig/wallets
 * @access Private (Admin)
 */
exports.getAllMultiSigWallets = async (req, res, next) => {
  try {
    const { isActive, cryptocurrency, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (cryptocurrency) query.cryptocurrency = { $eq: cryptocurrency };
    
    // Get wallets with pagination
    const skip = (page - 1) * limit;
    const wallets = await MultiSigWallet.find(query)
      .populate('owner', 'name email')
      .populate('signers.user', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await MultiSigWallet.countDocuments(query);
    
    logger.info(`Admin retrieved ${wallets.length} multi-sig wallets`);
    
    res.json({
      success: true,
      data: wallets,
      count: wallets.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Admin get all multi-sig wallets error:', error);
    next(error);
  }
};

/**
 * Get multi-sig wallet by ID (Admin)
 * GET /api/admin/multi-sig/wallets/:id
 * @access Private (Admin)
 */
exports.getMultiSigWalletById = async (req, res, next) => {
  try {
    const wallet = await MultiSigWallet.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('signers.user', 'name email');
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    
    // Get associated transactions
    const transactions = await TransactionApproval.find({ wallet: wallet._id })
      .populate('order')
      .populate('metadata.initiatedBy', 'name email')
      .populate('approvals.signer', 'name email')
      .sort('-createdAt');
    
    logger.info(`Admin retrieved wallet ${req.params.id}`);
    
    res.json({
      success: true,
      data: {
        wallet,
        transactions
      }
    });
  } catch (error) {
    logger.error('Admin get multi-sig wallet by ID error:', error);
    next(error);
  }
};

/**
 * Get all multi-sig transactions (Admin)
 * GET /api/admin/multi-sig/transactions
 * @access Private (Admin)
 */
exports.getAllMultiSigTransactions = async (req, res, next) => {
  try {
    const { status, cryptocurrency, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = {};
    if (status) query.status = status;
    if (cryptocurrency) query.cryptocurrency = cryptocurrency;
    
    // Get transactions with pagination
    const skip = (page - 1) * limit;
    const transactions = await TransactionApproval.find(query)
      .populate('wallet', 'name address cryptocurrency')
      .populate('order')
      .populate('metadata.initiatedBy', 'name email')
      .populate('approvals.signer', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await TransactionApproval.countDocuments(query);
    
    logger.info(`Admin retrieved ${transactions.length} multi-sig transactions`);
    
    res.json({
      success: true,
      data: transactions,
      count: transactions.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Admin get all multi-sig transactions error:', error);
    next(error);
  }
};

/**
 * Get multi-sig transaction by ID (Admin)
 * GET /api/admin/multi-sig/transactions/:id
 * @access Private (Admin)
 */
exports.getMultiSigTransactionById = async (req, res, next) => {
  try {
    const transaction = await TransactionApproval.findById(req.params.id)
      .populate('wallet')
      .populate('order')
      .populate('metadata.initiatedBy', 'name email')
      .populate('approvals.signer', 'name email');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    // Populate wallet details
    await transaction.wallet.populate('owner', 'name email');
    await transaction.wallet.populate('signers.user', 'name email');
    
    logger.info(`Admin retrieved transaction ${req.params.id}`);
    
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Admin get multi-sig transaction by ID error:', error);
    next(error);
  }
};

/**
 * Update multi-sig wallet status (Admin)
 * PUT /api/admin/multi-sig/wallets/:id/status
 * @access Private (Admin)
 */
exports.updateMultiSigWalletStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    
    const wallet = await MultiSigWallet.findById(req.params.id);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    
    wallet.isActive = isActive;
    await wallet.save();
    
    logger.info(`Admin updated wallet ${req.params.id} status to ${isActive ? 'active' : 'inactive'}`);
    
    res.json({
      success: true,
      data: wallet,
      message: `Wallet ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    logger.error('Admin update multi-sig wallet status error:', error);
    next(error);
  }
};

/**
 * Get multi-sig statistics (Admin)
 * GET /api/admin/multi-sig/stats
 * @access Private (Admin)
 */
exports.getMultiSigStats = async (req, res, next) => {
  try {
    const [
      totalWallets,
      activeWallets,
      totalTransactions,
      pendingTransactions,
      approvedTransactions,
      executedTransactions,
      rejectedTransactions
    ] = await Promise.all([
      MultiSigWallet.countDocuments(),
      MultiSigWallet.countDocuments({ isActive: true }),
      TransactionApproval.countDocuments(),
      TransactionApproval.countDocuments({ status: 'pending' }),
      TransactionApproval.countDocuments({ status: 'approved' }),
      TransactionApproval.countDocuments({ status: 'executed' }),
      TransactionApproval.countDocuments({ status: 'rejected' })
    ]);
    
    // Get transactions by cryptocurrency
    const transactionsByCrypto = await TransactionApproval.aggregate([
      {
        $group: {
          _id: '$cryptocurrency',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get recent pending transactions
    const recentPending = await TransactionApproval.find({ status: 'pending' })
      .populate('wallet', 'name cryptocurrency')
      .populate('metadata.initiatedBy', 'name email')
      .sort('-createdAt')
      .limit(10);
    
    logger.info('Admin retrieved multi-sig statistics');
    
    res.json({
      success: true,
      data: {
        wallets: {
          total: totalWallets,
          active: activeWallets,
          inactive: totalWallets - activeWallets
        },
        transactions: {
          total: totalTransactions,
          pending: pendingTransactions,
          approved: approvedTransactions,
          executed: executedTransactions,
          rejected: rejectedTransactions
        },
        byCryptocurrency: transactionsByCrypto,
        recentPending
      }
    });
  } catch (error) {
    logger.error('Admin get multi-sig stats error:', error);
    next(error);
  }
};

/**
 * Bulk reorder products
 * PUT /api/admin/products/reorder
 * @access Private (Admin)
 */
exports.reorderProducts = async (req, res, next) => {
  try {
    const { productOrders } = req.body;

    if (!productOrders || !Array.isArray(productOrders)) {
      return res.status(400).json({
        success: false,
        message: 'productOrders array is required'
      });
    }

    // Bulk update all product orders
    const bulkOps = productOrders.map(({ productId, sortOrder }) => ({
      updateOne: {
        filter: { _id: productId },
        update: { $set: { sortOrder } }
      }
    }));

    await Product.bulkWrite(bulkOps);

    logger.info(`Reordered ${productOrders.length} products`);

    res.json({
      success: true,
      message: 'Products reordered successfully'
    });
  } catch (error) {
    logger.error('Product reorder error:', error);
    next(error);
  }
};

/**
 * Export products to CSV
 * GET /api/admin/products/export/csv
 * @access Private (Admin)
 */
exports.exportProductsCSV = async (req, res, next) => {
  try {
    const { search, category } = req.query;

    const query = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    const filePath = await exportProductsToCSV(products);

    res.download(filePath, `products-${Date.now()}.csv`, (err) => {
      if (err) {
        logger.error('File download error:', err);
      }
      // Clean up file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) logger.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    logger.error('Product CSV export error:', error);
    next(error);
  }
};

/**
 * Export products to PDF
 * GET /api/admin/products/export/pdf
 * @access Private (Admin)
 */
exports.exportProductsPDF = async (req, res, next) => {
  try {
    const { search, category } = req.query;

    const query = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    const filePath = await exportProductsToPDF(products);

    res.download(filePath, `products-${Date.now()}.pdf`, (err) => {
      if (err) {
        logger.error('File download error:', err);
      }
      // Clean up file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) logger.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    logger.error('Product PDF export error:', error);
    next(error);
  }
};

/**
 * Export orders to CSV
 * GET /api/admin/orders/export/csv
 * @access Private (Admin)
 */
exports.exportOrdersCSV = async (req, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const filePath = await exportOrdersToCSV(orders);

    res.download(filePath, `orders-${Date.now()}.csv`, (err) => {
      if (err) {
        logger.error('File download error:', err);
      }
      // Clean up file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) logger.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    logger.error('Order CSV export error:', error);
    next(error);
  }
};

/**
 * Export orders to PDF
 * GET /api/admin/orders/export/pdf
 * @access Private (Admin)
 */
exports.exportOrdersPDF = async (req, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const filePath = await exportOrdersToPDF(orders);

    res.download(filePath, `orders-${Date.now()}.pdf`, (err) => {
      if (err) {
        logger.error('File download error:', err);
      }
      // Clean up file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) logger.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    logger.error('Order PDF export error:', error);
    next(error);
  }
};

/**
 * Export users to CSV
 * GET /api/admin/users/export/csv
 * @access Private (Admin)
 */
exports.exportUsersCSV = async (req, res, next) => {
  try {
    const { role, search } = req.query;

    const query = {};
    if (role) {
      query.role = role;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const filePath = await exportUsersToCSV(users);

    res.download(filePath, `users-${Date.now()}.csv`, (err) => {
      if (err) {
        logger.error('File download error:', err);
      }
      // Clean up file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) logger.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    logger.error('User CSV export error:', error);
    next(error);
  }
};
