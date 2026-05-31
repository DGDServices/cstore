const PodProduct = require('../models/PodProduct');
const PodOrder = require('../models/PodOrder');
const Product = require('../models/Product');
const Order = require('../models/Order');
const printifyService = require('../services/printifyService');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * @desc    Get all POD products with pagination
 * @route   GET /api/printify/products
 * @access  Public
 */
const getPodProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const filter = { isActive: true };
  
  // Filter by sync status if provided
  if (req.query.syncStatus) {
    filter.syncStatus = req.query.syncStatus;
  }
  
  // Filter by published status
  if (req.query.isPublished !== undefined) {
    filter.isPublished = req.query.isPublished === 'true';
  }
  
  const podProducts = await PodProduct.find(filter)
    .populate('product', 'name description price priceUSD images')
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
 * @desc    Get single POD product
 * @route   GET /api/printify/products/:id
 * @access  Public
 */
const getPodProduct = asyncHandler(async (req, res, next) => {
  const podProduct = await PodProduct.findById(req.params.id)
    .populate('product', 'name description price priceUSD images category');
  
  if (!podProduct) {
    return next(new AppError('POD product not found', 404));
  }
  
  res.json({
    success: true,
    data: { product: podProduct }
  });
});

/**
 * @desc    Sync products from Printify
 * @route   POST /api/printify/products/sync
 * @access  Private/Admin
 */
const syncPrintifyProducts = asyncHandler(async (req, res, next) => {
  if (!printifyService.isEnabled()) {
    return next(new AppError('Printify service is not enabled', 400));
  }
  
  try {
    // Get all products from Printify
    const printifyProducts = await printifyService.getProducts();
    
    let syncedCount = 0;
    let failedCount = 0;
    const errors = [];
    
    for (const printifyProduct of printifyProducts.data || printifyProducts) {
      try {
        // Check if product already exists
        let podProduct = await PodProduct.findOne({ 
          printifyProductId: printifyProduct.id 
        });
        
        // Prepare variant data
        const variants = (printifyProduct.variants || []).map(v => ({
          printifyVariantId: v.id.toString(),
          sku: v.sku,
          title: v.title,
          price: v.price / 100, // Convert cents to dollars
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
        
        const productData = {
          printifyProductId: printifyProduct.id,
          printifyBlueprintId: printifyProduct.blueprint_id.toString(),
          printifyPrintProviderId: printifyProduct.print_provider_id,
          title: printifyProduct.title,
          description: printifyProduct.description,
          tags: printifyProduct.tags || [],
          variants: variants,
          images: printifyProduct.images || [],
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
          blueprintTitle: printifyProduct.blueprint?.title,
          printProviderTitle: printifyProduct.print_provider?.title,
          printProviderLocation: printifyProduct.print_provider?.location,
          isPublished: printifyProduct.is_published || false
        };
        
        if (podProduct) {
          // Update existing product
          Object.assign(podProduct, productData);
          await podProduct.save();
        } else {
          // Create standard product first if it doesn't exist
          let standardProduct = await Product.create({
            name: printifyProduct.title,
            description: printifyProduct.description || 'POD Product',
            price: variants[0]?.price || 0,
            priceUSD: variants[0]?.price || 0,
            currency: 'USD',
            stock: 999, // POD products are always in stock
            images: (printifyProduct.images || []).map(img => ({
              url: img.src,
              alt: printifyProduct.title
            })),
            isActive: true
          });
          
          // Create POD product
          productData.product = standardProduct._id;
          podProduct = await PodProduct.create(productData);
        }
        
        syncedCount++;
      } catch (error) {
        failedCount++;
        errors.push({
          productId: printifyProduct.id,
          error: error.message
        });
        logger.error(`Failed to sync product ${printifyProduct.id}:`, error);
      }
    }
    
    logger.info(`Printify sync completed: ${syncedCount} synced, ${failedCount} failed`);
    
    res.json({
      success: true,
      message: 'Product sync completed',
      data: {
        synced: syncedCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    logger.error('Printify sync error:', error);
    return next(new AppError('Failed to sync Printify products', 500));
  }
});

/**
 * @desc    Create POD order
 * @route   POST /api/printify/orders
 * @access  Private
 */
const createPodOrder = asyncHandler(async (req, res, next) => {
  if (!printifyService.isEnabled()) {
    return next(new AppError('Printify service is not enabled', 400));
  }
  
  const { orderId, items, shippingAddress } = req.body;
  
  // Validate order exists
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new AppError('Order items are required', 400));
  }
  
  // Validate shipping address
  if (!shippingAddress || !shippingAddress.firstName || !shippingAddress.lastName ||
      !shippingAddress.email || !shippingAddress.country || !shippingAddress.address1 ||
      !shippingAddress.city || !shippingAddress.zip) {
    return next(new AppError('Complete shipping address is required', 400));
  }
  
  try {
    // Prepare items for Printify
    const printifyItems = [];
    let totalCost = 0;
    let totalPrice = 0;
    
    for (const item of items) {
      const podProduct = await PodProduct.findById(item.podProductId);
      if (!podProduct) {
        return next(new AppError(`POD product ${item.podProductId} not found`, 404));
      }
      
      const variant = podProduct.variants.find(v => 
        v.printifyVariantId === item.variantId
      );
      
      if (!variant) {
        return next(new AppError(`Variant ${item.variantId} not found`, 404));
      }
      
      printifyItems.push({
        product_id: podProduct.printifyProductId,
        variant_id: item.variantId,
        quantity: item.quantity
      });
      
      totalCost += variant.cost * item.quantity;
      totalPrice += variant.price * item.quantity;
    }
    
    // Create POD order in database
    const podOrder = await PodOrder.create({
      order: orderId,
      items: items.map(item => ({
        podProduct: item.podProductId,
        printifyProductId: item.printifyProductId,
        variantId: item.variantId,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost
      })),
      shippingAddress,
      status: 'draft',
      totalCost,
      totalPrice
    });
    
    logger.info(`Created POD order ${podOrder._id} for order ${orderId}`);
    
    res.status(201).json({
      success: true,
      message: 'POD order created successfully',
      data: { podOrder }
    });
  } catch (error) {
    logger.error('Failed to create POD order:', error);
    return next(new AppError('Failed to create POD order', 500));
  }
});

/**
 * @desc    Submit POD order to Printify
 * @route   POST /api/printify/orders/:id/submit
 * @access  Private/Admin
 */
const submitPodOrder = asyncHandler(async (req, res, next) => {
  if (!printifyService.isEnabled()) {
    return next(new AppError('Printify service is not enabled', 400));
  }
  
  const podOrder = await PodOrder.findById(req.params.id)
    .populate('items.podProduct');
  
  if (!podOrder) {
    return next(new AppError('POD order not found', 404));
  }
  
  if (podOrder.status !== 'draft') {
    return next(new AppError('Order has already been submitted', 400));
  }
  
  try {
    // Prepare order data for Printify
    const printifyOrderData = {
      external_id: podOrder._id.toString(),
      label: `Order #${podOrder.order}`,
      line_items: podOrder.items.map(item => ({
        product_id: item.printifyProductId,
        variant_id: item.variantId.toString(),
        quantity: item.quantity
      })),
      shipping_method: 1, // Standard shipping
      send_shipping_notification: true,
      address_to: {
        first_name: podOrder.shippingAddress.firstName,
        last_name: podOrder.shippingAddress.lastName,
        email: podOrder.shippingAddress.email,
        phone: podOrder.shippingAddress.phone || '',
        country: podOrder.shippingAddress.country,
        region: podOrder.shippingAddress.region || '',
        address1: podOrder.shippingAddress.address1,
        address2: podOrder.shippingAddress.address2 || '',
        city: podOrder.shippingAddress.city,
        zip: podOrder.shippingAddress.zip
      }
    };
    
    // Create order in Printify
    const printifyResponse = await printifyService.createOrder(printifyOrderData);
    
    // Update POD order with Printify order ID
    podOrder.printifyOrderId = printifyResponse.id;
    podOrder.printifyResponse = printifyResponse;
    await podOrder.updateStatus('pending', 'Submitted to Printify');
    
    // Submit to production if auto-submit is enabled
    if (req.body.autoSubmit !== false) {
      await printifyService.submitOrder(printifyResponse.id);
      await podOrder.updateStatus('in_production', 'Submitted to production');
    }
    
    logger.info(`Submitted POD order ${podOrder._id} to Printify: ${printifyResponse.id}`);
    
    res.json({
      success: true,
      message: 'Order submitted to Printify successfully',
      data: { 
        podOrder,
        printifyOrderId: printifyResponse.id
      }
    });
  } catch (error) {
    await podOrder.setError(error.message, error.response?.data);
    logger.error('Failed to submit order to Printify:', error);
    return next(new AppError('Failed to submit order to Printify', 500));
  }
});

/**
 * @desc    Get POD order details
 * @route   GET /api/printify/orders/:id
 * @access  Private
 */
const getPodOrder = asyncHandler(async (req, res, next) => {
  const podOrder = await PodOrder.findById(req.params.id)
    .populate('order')
    .populate('items.podProduct');
  
  if (!podOrder) {
    return next(new AppError('POD order not found', 404));
  }
  
  // Check if user has permission to view this order
  if (req.user.role !== 'admin' && podOrder.order.user.toString() !== req.user.id) {
    return next(new AppError('Not authorized to view this order', 403));
  }
  
  res.json({
    success: true,
    data: { podOrder }
  });
});

/**
 * @desc    List all POD orders
 * @route   GET /api/printify/orders
 * @access  Private/Admin
 */
const listPodOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const filter = {};
  
  // Filter by status
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  const podOrders = await PodOrder.find(filter)
    .populate('order', 'orderNumber customerEmail totalPrice')
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
 * @desc    Cancel POD order
 * @route   POST /api/printify/orders/:id/cancel
 * @access  Private/Admin
 */
const cancelPodOrder = asyncHandler(async (req, res, next) => {
  if (!printifyService.isEnabled()) {
    return next(new AppError('Printify service is not enabled', 400));
  }
  
  const podOrder = await PodOrder.findById(req.params.id);
  
  if (!podOrder) {
    return next(new AppError('POD order not found', 404));
  }
  
  if (!podOrder.printifyOrderId) {
    return next(new AppError('Order has not been submitted to Printify', 400));
  }
  
  try {
    await printifyService.cancelOrder(podOrder.printifyOrderId);
    await podOrder.updateStatus('cancelled', 'Cancelled by admin');
    
    logger.info(`Cancelled POD order ${podOrder._id}`);
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { podOrder }
    });
  } catch (error) {
    logger.error('Failed to cancel order:', error);
    return next(new AppError('Failed to cancel order', 500));
  }
});

module.exports = {
  getPodProducts,
  getPodProduct,
  syncPrintifyProducts,
  createPodOrder,
  submitPodOrder,
  getPodOrder,
  listPodOrders,
  cancelPodOrder
};
