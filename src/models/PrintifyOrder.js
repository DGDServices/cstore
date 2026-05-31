const mongoose = require('mongoose');

/**
 * PrintifyOrder Model
 * Links original crypto orders to Printify orders after conversion
 * This is separate from PodOrder to track the conversion pipeline
 */
const printifyOrderSchema = new mongoose.Schema({
  // Link to original order
  originalOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  
  // Link to conversion transaction
  conversion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConversionTransaction',
    required: true,
    index: true
  },
  
  // Link to POD order (if using existing POD system)
  podOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PodOrder'
  },
  
  // Printify order details
  printifyOrderId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Products in the order
  products: [{
    printifyProductId: String,
    variantId: String,
    quantity: Number,
    price: Number,
    productName: String,
    metadata: mongoose.Schema.Types.Mixed
  }],
  
  // Shipping information
  shippingInfo: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    address1: String,
    address2: String,
    city: String,
    region: String,
    zip: String,
    country: String
  },
  
  // Order status
  status: {
    type: String,
    enum: [
      'pending',        // Waiting for conversion
      'ready',          // Conversion complete, ready to place
      'placed',         // Order placed with Printify
      'processing',     // Being processed by Printify
      'in_production',  // Being manufactured
      'shipped',        // Order shipped
      'delivered',      // Order delivered
      'cancelled',      // Order cancelled
      'failed'          // Order failed
    ],
    default: 'pending',
    index: true
  },
  
  // Tracking information
  trackingInfo: {
    number: String,
    url: String,
    carrier: String,
    shippedAt: Date,
    estimatedDelivery: Date
  },
  
  // Cost breakdown
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  productCost: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  
  // Payment tracking
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'ach', 'virtual_card'],
    default: 'stripe'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentReference: String,
  paidAt: Date,
  
  // Status history
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  
  // Error tracking
  lastError: {
    message: String,
    timestamp: Date,
    details: mongoose.Schema.Types.Mixed
  },
  
  // Webhook events from Printify
  webhookEvents: [{
    event: String,
    data: mongoose.Schema.Types.Mixed,
    receivedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  placedAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  retryCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
printifyOrderSchema.index({ originalOrder: 1 });
printifyOrderSchema.index({ conversion: 1 });
printifyOrderSchema.index({ status: 1, createdAt: -1 });
printifyOrderSchema.index({ printifyOrderId: 1 });
printifyOrderSchema.index({ paymentStatus: 1 });

// Methods
printifyOrderSchema.methods.updateStatus = function(newStatus, note) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || ''
  });
  
  // Update timestamps based on status
  if (newStatus === 'placed') {
    this.placedAt = new Date();
  } else if (newStatus === 'shipped') {
    this.shippedAt = new Date();
  } else if (newStatus === 'delivered') {
    this.deliveredAt = new Date();
  } else if (newStatus === 'cancelled') {
    this.cancelledAt = new Date();
  }
  
  return this.save();
};

printifyOrderSchema.methods.recordWebhookEvent = function(event, data) {
  this.webhookEvents.push({
    event,
    data,
    receivedAt: new Date()
  });
  return this.save();
};

printifyOrderSchema.methods.setError = function(errorMessage, details = {}) {
  this.lastError = {
    message: errorMessage,
    timestamp: new Date(),
    details
  };
  return this.save();
};

printifyOrderSchema.methods.markPaid = function(paymentRef) {
  this.paymentStatus = 'completed';
  this.paymentReference = paymentRef;
  this.paidAt = new Date();
  return this.save();
};

// Static methods
printifyOrderSchema.statics.getByOriginalOrder = function(orderId) {
  return this.findOne({ originalOrder: orderId });
};

printifyOrderSchema.statics.getPendingOrders = function() {
  return this.find({ 
    status: { $in: ['ready', 'pending'] } 
  }).sort({ createdAt: 1 });
};

printifyOrderSchema.statics.getOrdersRequiringPayment = function() {
  return this.find({ 
    status: 'ready',
    paymentStatus: 'pending'
  });
};

// Ensure virtuals are included in JSON output
printifyOrderSchema.set('toJSON', { virtuals: true });
printifyOrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PrintifyOrder', printifyOrderSchema);
