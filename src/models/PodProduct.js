const mongoose = require('mongoose');

/**
 * POD Product Schema - Integrates with Printify print-on-demand products
 */
const podProductSchema = new mongoose.Schema({
  // Link to standard product
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // Printify Integration Fields
  printifyProductId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  printifyBlueprintId: {
    type: String,
    required: true
  },
  
  printifyPrintProviderId: {
    type: Number,
    required: true
  },
  
  // Product Details
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  tags: [String],
  
  // Variants (sizes, colors, etc.)
  variants: [{
    printifyVariantId: {
      type: String,
      required: true
    },
    sku: String,
    title: String,
    price: {
      type: Number,
      required: true,
      min: 0
    },
    cost: {
      type: Number,
      required: true,
      min: 0
    },
    isEnabled: {
      type: Boolean,
      default: true
    },
    options: {
      size: String,
      color: String,
      material: String
    },
    grams: Number,
    isAvailable: {
      type: Boolean,
      default: true
    }
  }],
  
  // Images and Mockups
  images: [{
    src: String,
    variant_ids: [String],
    position: String,
    is_default: Boolean,
    is_selected_for_publishing: Boolean
  }],
  
  // Sync Status
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed', 'out_of_sync'],
    default: 'pending'
  },
  
  lastSyncedAt: {
    type: Date
  },
  
  syncError: {
    type: String
  },
  
  // Publishing Status
  isPublished: {
    type: Boolean,
    default: false
  },
  
  publishedAt: {
    type: Date
  },
  
  // Metadata from Printify
  blueprintTitle: String,
  printProviderTitle: String,
  printProviderLocation: String,
  
  // Shipping Information
  shippingInfo: {
    profiles: [{
      variant_ids: [String],
      first_item_cost: Number,
      additional_items_cost: Number,
      countries: [String]
    }]
  },
  
  // Sales Information
  salesCount: {
    type: Number,
    default: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
podProductSchema.index({ printifyProductId: 1 });
podProductSchema.index({ product: 1 });
podProductSchema.index({ isActive: 1, isPublished: 1 });
podProductSchema.index({ syncStatus: 1 });

// Methods
podProductSchema.methods.markSynced = function() {
  this.syncStatus = 'synced';
  this.lastSyncedAt = new Date();
  this.syncError = undefined;
  return this.save();
};

podProductSchema.methods.markSyncFailed = function(error) {
  this.syncStatus = 'failed';
  this.syncError = error;
  return this.save();
};

podProductSchema.methods.markOutOfSync = function() {
  this.syncStatus = 'out_of_sync';
  return this.save();
};

module.exports = mongoose.model('PodProduct', podProductSchema);
