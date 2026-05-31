const PrintifyOrder = require('../models/PrintifyOrder');
const PodOrder = require('../models/PodOrder');
const printifyService = require('../services/printifyService');
const logger = require('../utils/logger');

/**
 * Printify Controller
 * Handles Printify order placement and management with conversion integration
 */

/**
 * Place order with Printify after conversion
 * POST /api/printify/place-order
 */
exports.placeOrder = async (req, res) => {
  try {
    const { printifyOrderId } = req.body;

    if (!printifyOrderId) {
      return res.status(400).json({
        success: false,
        error: 'Printify order ID is required'
      });
    }

    const printifyOrder = await PrintifyOrder.findById(printifyOrderId)
      .populate('originalOrder')
      .populate('conversion');

    if (!printifyOrder) {
      return res.status(404).json({
        success: false,
        error: 'Printify order not found'
      });
    }

    if (printifyOrder.status !== 'ready') {
      return res.status(400).json({
        success: false,
        error: `Cannot place order in status: ${printifyOrder.status}`
      });
    }

    // Check if Printify service is enabled
    if (!printifyService.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Printify service is not enabled'
      });
    }

    // Prepare order data for Printify
    const orderData = {
      external_id: printifyOrder.originalOrder._id.toString(),
      label: `Order ${printifyOrder.originalOrder._id}`,
      line_items: printifyOrder.products.map(product => ({
        product_id: product.printifyProductId,
        variant_id: product.variantId,
        quantity: product.quantity
      })),
      shipping_method: 1, // Standard shipping
      send_shipping_notification: true,
      address_to: {
        first_name: printifyOrder.shippingInfo.firstName,
        last_name: printifyOrder.shippingInfo.lastName,
        email: printifyOrder.shippingInfo.email,
        phone: printifyOrder.shippingInfo.phone,
        country: printifyOrder.shippingInfo.country,
        region: printifyOrder.shippingInfo.region,
        address1: printifyOrder.shippingInfo.address1,
        address2: printifyOrder.shippingInfo.address2,
        city: printifyOrder.shippingInfo.city,
        zip: printifyOrder.shippingInfo.zip
      }
    };

    // Create order in Printify
    const printifyResponse = await printifyService.createOrder(orderData);

    // Update PrintifyOrder with Printify order ID
    printifyOrder.printifyOrderId = printifyResponse.id;
    await printifyOrder.updateStatus('placed', 'Order placed with Printify');

    // Create corresponding PodOrder if needed
    const podOrder = await PodOrder.create({
      order: printifyOrder.originalOrder._id,
      printifyOrderId: printifyResponse.id,
      items: printifyOrder.products.map(product => ({
        podProduct: null, // Would be populated if product exists
        printifyProductId: product.printifyProductId,
        variantId: product.variantId,
        quantity: product.quantity,
        price: product.price,
        cost: product.price
      })),
      shippingAddress: printifyOrder.shippingInfo,
      status: 'pending',
      totalCost: printifyOrder.totalCost,
      totalPrice: printifyOrder.totalCost,
      printifyResponse: printifyResponse
    });

    printifyOrder.podOrder = podOrder._id;
    await printifyOrder.save();

    logger.info(`Printify order placed successfully: ${printifyResponse.id}`);

    res.status(201).json({
      success: true,
      message: 'Order placed with Printify successfully',
      data: {
        printifyOrder,
        podOrder,
        printifyResponse
      }
    });
  } catch (error) {
    logger.error('Failed to place Printify order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get Printify order details
 * GET /api/printify/orders/:id
 */
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const printifyOrder = await PrintifyOrder.findById(id)
      .populate('originalOrder')
      .populate('conversion')
      .populate('podOrder');

    if (!printifyOrder) {
      return res.status(404).json({
        success: false,
        error: 'Printify order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: printifyOrder
    });
  } catch (error) {
    logger.error('Failed to get Printify order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get orders ready for placement
 * GET /api/printify/ready-orders
 */
exports.getReadyOrders = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can view ready orders'
      });
    }

    const readyOrders = await PrintifyOrder.getPendingOrders()
      .populate('originalOrder', 'customerEmail totalPrice')
      .populate('conversion', 'status fiatAmount');

    res.status(200).json({
      success: true,
      data: readyOrders
    });
  } catch (error) {
    logger.error('Failed to get ready orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Sync Printify order status
 * POST /api/printify/sync-order/:id
 */
exports.syncOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const printifyOrder = await PrintifyOrder.findById(id);
    if (!printifyOrder) {
      return res.status(404).json({
        success: false,
        error: 'Printify order not found'
      });
    }

    if (!printifyOrder.printifyOrderId) {
      return res.status(400).json({
        success: false,
        error: 'Order not yet placed with Printify'
      });
    }

    // Fetch order details from Printify
    const printifyData = await printifyService.getOrder(printifyOrder.printifyOrderId);

    // Update status based on Printify status
    const statusMap = {
      'pending': 'pending',
      'in-production': 'processing',
      'completed': 'shipped'
    };

    const newStatus = statusMap[printifyData.status] || printifyData.status;
    if (printifyOrder.status !== newStatus) {
      await printifyOrder.updateStatus(newStatus, `Synced from Printify: ${printifyData.status}`);
    }

    // Update tracking info if available
    if (printifyData.shipments && printifyData.shipments.length > 0) {
      const shipment = printifyData.shipments[0];
      printifyOrder.trackingInfo = {
        number: shipment.tracking_number,
        url: shipment.tracking_url,
        carrier: shipment.carrier
      };
      await printifyOrder.save();
    }

    logger.info(`Synced Printify order ${id} status: ${newStatus}`);

    res.status(200).json({
      success: true,
      message: 'Order status synced successfully',
      data: printifyOrder
    });
  } catch (error) {
    logger.error('Failed to sync order status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get Printify products
 * GET /api/printify/products
 */
exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;

    if (!printifyService.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Printify service is not enabled'
      });
    }

    const products = await printifyService.getProducts(page, limit);

    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    logger.error('Failed to get Printify products:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Sync products from Printify
 * POST /api/printify/sync-catalog
 */
exports.syncCatalog = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can sync catalog'
      });
    }

    if (!printifyService.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Printify service is not enabled'
      });
    }

    // This would integrate with PodProduct model to sync products
    // For now, just return success
    logger.info('Printify catalog sync initiated');

    res.status(200).json({
      success: true,
      message: 'Catalog sync initiated'
    });
  } catch (error) {
    logger.error('Failed to sync catalog:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Calculate shipping cost
 * POST /api/printify/calculate-shipping
 */
exports.calculateShipping = async (req, res) => {
  try {
    const { products, shippingAddress } = req.body;

    if (!printifyService.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Printify service is not enabled'
      });
    }

    // Prepare shipping calculation data
    const shippingData = {
      line_items: products.map(p => ({
        product_id: p.productId,
        variant_id: p.variantId,
        quantity: p.quantity
      })),
      address_to: shippingAddress
    };

    const shippingCost = await printifyService.calculateShipping(shippingData);

    res.status(200).json({
      success: true,
      data: shippingCost
    });
  } catch (error) {
    logger.error('Failed to calculate shipping:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;
