const mongoose = require('mongoose');

/**
 * POD Order Schema - Tracks print-on-demand orders through Printify
 */
const podOrderSchema = new mongoose.Schema({
  // Link to standard order
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  
  // Printify Order ID
  printifyOrderId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Order Items (POD-specific)
  items: [{
    podProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PodProduct',
      required: true
    },
    printifyProductId: {
      type: String,
      required: true
    },
    variantId: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    cost: {
      type: Number,
      required: true
    }
  }],
  
  // Shipping Address
  shippingAddress: {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: String,
    country: {
      type: String,
      required: true
    },
    region: String,
    address1: {
      type: String,
      required: true
    },
    address2: String,
    city: {
      type: String,
      required: true
    },
    zip: {
      type: String,
      required: true
    }
  },
  
  // Order Status
  status: {
    type: String,
    enum: [
      'draft',           // Order created but not submitted
      'pending',         // Submitted to Printify, awaiting processing
      'in_production',   // Being printed/manufactured
      'shipped',         // Order shipped
      'delivered',       // Order delivered
      'cancelled',       // Order cancelled
      'failed'          // Order failed
    ],
    default: 'draft'
  },
  
  // Tracking Information
  tracking: {
    number: String,
    url: String,
    carrier: String
  },
  
  // Shipping Details
  shippingMethod: String,
  shippingCost: {
    type: Number,
    default: 0
  },
  
  // Costs and Pricing
  totalCost: {
    type: Number,
    required: true
  },
  
  totalPrice: {
    type: Number,
    required: true
  },
  
  // Printify Response Data
  printifyResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Status History
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  
  // Error Tracking
  lastError: {
    message: String,
    timestamp: Date,
    details: mongoose.Schema.Types.Mixed
  },
  
  // Webhook Events
  webhookEvents: [{
    event: String,
    data: mongoose.Schema.Types.Mixed,
    receivedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  submittedAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date
}, {
  timestamps: true
});

// Indexes
podOrderSchema.index({ order: 1 });
podOrderSchema.index({ printifyOrderId: 1 });
podOrderSchema.index({ status: 1 });
podOrderSchema.index({ createdAt: -1 });

// Methods
podOrderSchema.methods.updateStatus = function(newStatus, note) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || ''
  });
  
  // Update timestamps based on status
  if (newStatus === 'pending') {
    this.submittedAt = new Date();
  } else if (newStatus === 'shipped') {
    this.shippedAt = new Date();
  } else if (newStatus === 'delivered') {
    this.deliveredAt = new Date();
  } else if (newStatus === 'cancelled') {
    this.cancelledAt = new Date();
  }
  
  return this.save();
};

podOrderSchema.methods.recordWebhookEvent = function(event, data) {
  this.webhookEvents.push({
    event,
    data,
    receivedAt: new Date()
  });
  return this.save();
};

podOrderSchema.methods.setError = function(errorMessage, details) {
  this.lastError = {
    message: errorMessage,
    timestamp: new Date(),
    details: details || {}
  };
  return this.save();
};

module.exports = mongoose.model('PodOrder', podOrderSchema);
