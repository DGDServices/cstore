const PodProduct = require('../models/PodProduct');
const PodOrder = require('../models/PodOrder');
const printifyService = require('../services/printifyService');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * @desc    Get POD dashboard statistics
 * @route   GET /api/admin/pod/stats
 * @access  Private/Admin
 */
const getPodStats = asyncHandler(async (req, res) => {
  const totalProducts = await PodProduct.countDocuments({ isActive: true });
  const publishedProducts = await PodProduct.countDocuments({ 
    isActive: true, 
    isPublished: true 
  });
  const syncPendingProducts = await PodProduct.countDocuments({ 
    syncStatus: { $in: ['pending', 'out_of_sync'] }
  });
  
  const totalOrders = await PodOrder.countDocuments();
  const pendingOrders = await PodOrder.countDocuments({ status: 'pending' });
  const inProductionOrders = await PodOrder.countDocuments({ status: 'in_production' });
  const shippedOrders = await PodOrder.countDocuments({ status: 'shipped' });
  const deliveredOrders = await PodOrder.countDocuments({ status: 'delivered' });
  
  // Calculate revenue
  const revenueResult = await PodOrder.aggregate([
    {
      $match: {
        status: { $in: ['shipped', 'delivered'] }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalPrice' },
        totalCost: { $sum: '$totalCost' }
      }
    }
  ]);
  
  const revenue = revenueResult[0] || { totalRevenue: 0, totalCost: 0 };
  const profit = revenue.totalRevenue - revenue.totalCost;
  
  res.json({
    success: true,
    data: {
      products: {
        total: totalProducts,
        published: publishedProducts,
        syncPending: syncPendingProducts
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        inProduction: inProductionOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders
      },
      revenue: {
        total: revenue.totalRevenue,
        cost: revenue.totalCost,
        profit: profit
      }
    }
  });
});

/**
 * @desc    Get POD products for admin with full details
 * @route   GET /api/admin/pod/products
 * @access  Private/Admin
 */
const getAdminPodProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const filter = {};
  
  // Filter by sync status
  if (req.query.syncStatus) {
    filter.syncStatus = req.query.syncStatus;
  }
  
  // Filter by published status
  if (req.query.isPublished !== undefined) {
    filter.isPublished = req.query.isPublished === 'true';
  }
  
  // Search by title
  if (req.query.search) {
    filter.title = { $regex: req.query.search, $options: 'i' };
  }
  
  const podProducts = await PodProduct.find(filter)
    .populate('product')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await PodProduct.countDocuments(filter);
  
  res.json({
    success: true,
    data: {
      products: podProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * @desc    Update POD product
 * @route   PUT /api/admin/pod/products/:id
 * @access  Private/Admin
 */
const updatePodProduct = asyncHandler(async (req, res, next) => {
  const podProduct = await PodProduct.findById(req.params.id);
  
  if (!podProduct) {
    return next(new AppError('POD product not found', 404));
  }
  
  const allowedUpdates = ['isActive', 'isPublished', 'tags'];
  const updates = {};
  
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });
  
  Object.assign(podProduct, updates);
  await podProduct.save();
  
  logger.info(`Updated POD product ${podProduct._id} by admin ${req.user.email}`);
  
  res.json({
    success: true,
    message: 'POD product updated successfully',
    data: { product: podProduct }
  });
});

/**
 * @desc    Delete POD product
 * @route   DELETE /api/admin/pod/products/:id
 * @access  Private/Admin
 */
const deletePodProduct = asyncHandler(async (req, res, next) => {
  const podProduct = await PodProduct.findById(req.params.id);
  
  if (!podProduct) {
    return next(new AppError('POD product not found', 404));
  }
  
  // Soft delete
  podProduct.isActive = false;
  await podProduct.save();
  
  logger.info(`Deleted POD product ${podProduct._id} by admin ${req.user.email}`);
  
  res.json({
    success: true,
    message: 'POD product deleted successfully'
  });
});

/**
 * @desc    Get POD orders for admin
 * @route   GET /api/admin/pod/orders
 * @access  Private/Admin
 */
const getAdminPodOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const filter = {};
  
  // Filter by status
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  // Date range filter
  if (req.query.startDate || req.query.endDate) {
    filter.createdAt = {};
    if (req.query.startDate) {
      filter.createdAt.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      filter.createdAt.$lte = new Date(req.query.endDate);
    }
  }
  
  const podOrders = await PodOrder.find(filter)
    .populate('order', 'orderNumber customerEmail totalPrice status')
    .populate('items.podProduct', 'title printifyProductId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await PodOrder.countDocuments(filter);
  
  res.json({
    success: true,
    data: {
      orders: podOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * @desc    Get POD order details for admin
 * @route   GET /api/admin/pod/orders/:id
 * @access  Private/Admin
 */
const getAdminPodOrder = asyncHandler(async (req, res, next) => {
  const podOrder = await PodOrder.findById(req.params.id)
    .populate('order')
    .populate('items.podProduct');
  
  if (!podOrder) {
    return next(new AppError('POD order not found', 404));
  }
  
  res.json({
    success: true,
    data: { order: podOrder }
  });
});

/**
 * @desc    Sync single product from Printify
 * @route   POST /api/admin/pod/products/:id/sync
 * @access  Private/Admin
 */
const syncSingleProduct = asyncHandler(async (req, res, next) => {
  if (!printifyService.isEnabled()) {
    return next(new AppError('Printify service is not enabled', 400));
  }
  
  const podProduct = await PodProduct.findById(req.params.id);
  
  if (!podProduct) {
    return next(new AppError('POD product not found', 404));
  }
  
  try {
    // Fetch latest data from Printify
    const printifyProduct = await printifyService.getProduct(podProduct.printifyProductId);
    
    // Update product data
    const variants = (printifyProduct.variants || []).map(v => ({
      printifyVariantId: v.id.toString(),
      sku: v.sku,
      title: v.title,
      price: v.price / 100,
      cost: v.cost / 100,
      isEnabled: v.is_enabled,
      options: {
        size: v.options?.size,
        color: v.options?.color,
        material: v.options?.material
      },
      grams: v.grams,
      isAvailable: v.is_available
    }));
    
    podProduct.title = printifyProduct.title;
    podProduct.description = printifyProduct.description;
    podProduct.variants = variants;
    podProduct.images = printifyProduct.images || [];
    podProduct.isPublished = printifyProduct.is_published || false;
    
    await podProduct.markSynced();
    
    logger.info(`Synced POD product ${podProduct._id} from Printify`);
    
    res.json({
      success: true,
      message: 'Product synced successfully',
      data: { product: podProduct }
    });
  } catch (error) {
    await podProduct.markSyncFailed(error.message);
    logger.error(`Failed to sync product ${podProduct._id}:`, error);
    return next(new AppError('Failed to sync product from Printify', 500));
  }
});

/**
 * @desc    Publish product to Printify
 * @route   POST /api/admin/pod/products/:id/publish
 * @access  Private/Admin
 */
const publishProduct = asyncHandler(async (req, res, next) => {
  if (!printifyService.isEnabled()) {
    return next(new AppError('Printify service is not enabled', 400));
  }
  
  const podProduct = await PodProduct.findById(req.params.id);
  
  if (!podProduct) {
    return next(new AppError('POD product not found', 404));
  }
  
  try {
    await printifyService.publishProduct(podProduct.printifyProductId);
    
    podProduct.isPublished = true;
    podProduct.publishedAt = new Date();
    await podProduct.save();
    
    logger.info(`Published POD product ${podProduct._id} to Printify`);
    
    res.json({
      success: true,
      message: 'Product published successfully',
      data: { product: podProduct }
    });
  } catch (error) {
    logger.error(`Failed to publish product ${podProduct._id}:`, error);
    return next(new AppError('Failed to publish product', 500));
  }
});

/**
 * @desc    Get Printify catalog (blueprints)
 * @route   GET /api/admin/pod/catalog/blueprints
 * @access  Private/Admin
 */
const getBlueprints = asyncHandler(async (req, res, next) => {
  if (!printifyService.isEnabled()) {
    return next(new AppError('Printify service is not enabled', 400));
  }
  
  try {
    const blueprints = await printifyService.getBlueprints();
    
    res.json({
      success: true,
      data: { blueprints }
    });
  } catch (error) {
    logger.error('Failed to get blueprints:', error);
    return next(new AppError('Failed to get blueprints', 500));
  }
});

/**
 * @desc    Get print providers for a blueprint
 * @route   GET /api/admin/pod/catalog/blueprints/:id/providers
 * @access  Private/Admin
 */
const getPrintProviders = asyncHandler(async (req, res, next) => {
  if (!printifyService.isEnabled()) {
    return next(new AppError('Printify service is not enabled', 400));
  }
  
  try {
    const providers = await printifyService.getPrintProviders(req.params.id);
    
    res.json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    logger.error('Failed to get print providers:', error);
    return next(new AppError('Failed to get print providers', 500));
  }
});

module.exports = {
  getPodStats,
  getAdminPodProducts,
  updatePodProduct,
  deletePodProduct,
  getAdminPodOrders,
  getAdminPodOrder,
  syncSingleProduct,
  publishProduct,
  getBlueprints,
  getPrintProviders
};
