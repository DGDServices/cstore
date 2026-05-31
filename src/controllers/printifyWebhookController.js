const PodOrder = require('../models/PodOrder');
const Order = require('../models/Order');
const logger = require('../utils/logger');
const { sendEmail } = require('../services/emailService');

/**
 * @desc    Handle Printify webhook events
 * @route   POST /api/webhooks/printify
 * @access  Public (but signature verified)
 */
const handlePrintifyWebhook = async (req, res) => {
  try {
    const { type, resource } = req.body;
    
    logger.info('Printify webhook received:', {
      type,
      resourceId: resource?.id,
      resourceType: resource?.type
    });
    
    // Handle different webhook event types
    switch (type) {
      case 'order:created':
        await handleOrderCreated(resource);
        break;
      
      case 'order:updated':
        await handleOrderUpdated(resource);
        break;
      
      case 'order:sent-to-production':
        await handleOrderSentToProduction(resource);
        break;
      
      case 'order:shipment:created':
        await handleShipmentCreated(resource);
        break;
      
      case 'order:shipment:delivered':
        await handleShipmentDelivered(resource);
        break;
      
      case 'product:publish:started':
        await handleProductPublishStarted(resource);
        break;
      
      case 'product:publish:succeeded':
        await handleProductPublishSucceeded(resource);
        break;
      
      case 'product:publish:failed':
        await handleProductPublishFailed(resource);
        break;
      
      default:
        logger.info(`Unhandled webhook type: ${type}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    logger.error('Error processing Printify webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Handle order created event
 */
async function handleOrderCreated(resource) {
  logger.info(`Order created in Printify: ${resource.id}`);
  
  // Find POD order by Printify order ID
  const podOrder = await PodOrder.findOne({ printifyOrderId: resource.id });
  
  if (podOrder) {
    await podOrder.recordWebhookEvent('order:created', resource);
    logger.info(`Recorded order:created event for POD order ${podOrder._id}`);
  }
}

/**
 * Handle order updated event
 */
async function handleOrderUpdated(resource) {
  logger.info(`Order updated in Printify: ${resource.id}`);
  
  const podOrder = await PodOrder.findOne({ printifyOrderId: resource.id })
    .populate('order');
  
  if (!podOrder) {
    logger.warn(`POD order not found for Printify order ${resource.id}`);
    return;
  }
  
  // Record webhook event
  await podOrder.recordWebhookEvent('order:updated', resource);
  
  // Update order status based on Printify status
  if (resource.status) {
    const statusMap = {
      'pending': 'pending',
      'in-production': 'in_production',
      'completed': 'shipped',
      'canceled': 'cancelled'
    };
    
    const newStatus = statusMap[resource.status] || resource.status;
    if (podOrder.status !== newStatus) {
      await podOrder.updateStatus(newStatus, `Updated via webhook: ${resource.status}`);
    }
  }
  
  logger.info(`Updated POD order ${podOrder._id} status`);
}

/**
 * Handle order sent to production event
 */
async function handleOrderSentToProduction(resource) {
  logger.info(`Order sent to production: ${resource.id}`);
  
  const podOrder = await PodOrder.findOne({ printifyOrderId: resource.id })
    .populate('order');
  
  if (!podOrder) {
    logger.warn(`POD order not found for Printify order ${resource.id}`);
    return;
  }
  
  // Update status
  await podOrder.updateStatus('in_production', 'Order sent to production');
  await podOrder.recordWebhookEvent('order:sent-to-production', resource);
  
  // Update main order status
  if (podOrder.order) {
    const order = await Order.findById(podOrder.order);
    if (order && order.status === 'paid') {
      order.status = 'processing';
      await order.save();
    }
  }
  
  // Send email notification
  if (podOrder.shippingAddress.email) {
    try {
      await sendEmail({
        to: podOrder.shippingAddress.email,
        subject: 'Your Order is in Production',
        template: 'order-in-production',
        context: {
          orderId: podOrder.order,
          firstName: podOrder.shippingAddress.firstName
        }
      });
    } catch (emailError) {
      logger.error('Failed to send production notification email:', emailError);
    }
  }
  
  logger.info(`POD order ${podOrder._id} sent to production`);
}

/**
 * Handle shipment created event
 */
async function handleShipmentCreated(resource) {
  logger.info(`Shipment created for order: ${resource.order_id}`);
  
  const podOrder = await PodOrder.findOne({ printifyOrderId: resource.order_id })
    .populate('order');
  
  if (!podOrder) {
    logger.warn(`POD order not found for Printify order ${resource.order_id}`);
    return;
  }
  
  // Update tracking information
  if (resource.tracking_number) {
    podOrder.tracking = {
      number: resource.tracking_number,
      url: resource.tracking_url,
      carrier: resource.carrier
    };
  }
  
  // Update status to shipped
  await podOrder.updateStatus('shipped', 'Order shipped');
  await podOrder.recordWebhookEvent('order:shipment:created', resource);
  
  // Update main order status
  if (podOrder.order) {
    const order = await Order.findById(podOrder.order);
    if (order) {
      order.status = 'shipped';
      await order.save();
    }
  }
  
  // Send shipping notification email
  if (podOrder.shippingAddress.email) {
    try {
      await sendEmail({
        to: podOrder.shippingAddress.email,
        subject: 'Your Order Has Shipped!',
        template: 'order-shipped',
        context: {
          orderId: podOrder.order,
          firstName: podOrder.shippingAddress.firstName,
          trackingNumber: resource.tracking_number,
          trackingUrl: resource.tracking_url,
          carrier: resource.carrier
        }
      });
    } catch (emailError) {
      logger.error('Failed to send shipping notification email:', emailError);
    }
  }
  
  logger.info(`POD order ${podOrder._id} marked as shipped`);
}

/**
 * Handle shipment delivered event
 */
async function handleShipmentDelivered(resource) {
  logger.info(`Shipment delivered for order: ${resource.order_id}`);
  
  const podOrder = await PodOrder.findOne({ printifyOrderId: resource.order_id })
    .populate('order');
  
  if (!podOrder) {
    logger.warn(`POD order not found for Printify order ${resource.order_id}`);
    return;
  }
  
  // Update status to delivered
  await podOrder.updateStatus('delivered', 'Order delivered');
  await podOrder.recordWebhookEvent('order:shipment:delivered', resource);
  
  // Update main order status
  if (podOrder.order) {
    const order = await Order.findById(podOrder.order);
    if (order) {
      order.status = 'delivered';
      await order.save();
    }
  }
  
  // Send delivery confirmation email
  if (podOrder.shippingAddress.email) {
    try {
      await sendEmail({
        to: podOrder.shippingAddress.email,
        subject: 'Your Order Has Been Delivered',
        template: 'order-delivered',
        context: {
          orderId: podOrder.order,
          firstName: podOrder.shippingAddress.firstName
        }
      });
    } catch (emailError) {
      logger.error('Failed to send delivery notification email:', emailError);
    }
  }
  
  logger.info(`POD order ${podOrder._id} marked as delivered`);
}

/**
 * Handle product publish started event
 */
async function handleProductPublishStarted(resource) {
  logger.info(`Product publish started: ${resource.id}`);
  // This is informational - no action needed
}

/**
 * Handle product publish succeeded event
 */
async function handleProductPublishSucceeded(resource) {
  logger.info(`Product publish succeeded: ${resource.id}`);
  
  const PodProduct = require('../models/PodProduct');
  const podProduct = await PodProduct.findOne({ printifyProductId: resource.id });
  
  if (podProduct) {
    podProduct.isPublished = true;
    podProduct.publishedAt = new Date();
    await podProduct.save();
    logger.info(`Marked POD product ${podProduct._id} as published`);
  }
}

/**
 * Handle product publish failed event
 */
async function handleProductPublishFailed(resource) {
  logger.error(`Product publish failed: ${resource.id}`, resource.errors);
  
  const PodProduct = require('../models/PodProduct');
  const podProduct = await PodProduct.findOne({ printifyProductId: resource.id });
  
  if (podProduct) {
    podProduct.isPublished = false;
    await podProduct.markSyncFailed(`Publish failed: ${JSON.stringify(resource.errors)}`);
    logger.error(`Marked POD product ${podProduct._id} publish as failed`);
  }
}

module.exports = {
  handlePrintifyWebhook
};
