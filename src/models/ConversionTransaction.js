const mongoose = require('mongoose');
const { ALL_SUPPORTED_CRYPTO_SYMBOLS } = require('../config/cryptocurrencies');

/**
 * ConversionTransaction Model
 * Tracks cryptocurrency to fiat currency conversions
 */
const conversionTransactionSchema = new mongoose.Schema({
  // Related order
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  
  // Crypto details
  cryptoAmount: {
    type: Number,
    required: true,
    min: 0
  },
  cryptocurrency: {
    type: String,
    required: true,
    enum: ALL_SUPPORTED_CRYPTO_SYMBOLS
  },
  
  // Fiat details
  fiatAmount: {
    type: Number,
    required: true,
    min: 0
  },
  fiatCurrency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true
  },
  
  // Exchange rate and details
  exchangeRate: {
    type: Number,
    required: true,
    min: 0
  },
  exchange: {
    type: String,
    required: true,
    enum: ['coinbase', 'kraken', 'binance', 'manual']
  },
  conversionId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'converting', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Fee breakdown
  fees: {
    exchangeFee: {
      type: Number,
      default: 0,
      min: 0
    },
    networkFee: {
      type: Number,
      default: 0,
      min: 0
    },
    processingFee: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Risk management
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  
  // Status history
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    metadata: mongoose.Schema.Types.Mixed
  }],
  
  // Error tracking
  lastError: {
    message: String,
    timestamp: Date,
    details: mongoose.Schema.Types.Mixed
  },
  
  // Metadata
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: Date,
  failedAt: Date,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  
  // Additional details
  metadata: {
    volatilityScore: Number,
    priceSlippage: Number,
    executionTime: Number,
    apiResponse: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
conversionTransactionSchema.index({ order: 1 });
conversionTransactionSchema.index({ status: 1, createdAt: -1 });
conversionTransactionSchema.index({ exchange: 1, status: 1 });
conversionTransactionSchema.index({ cryptocurrency: 1, createdAt: -1 });
conversionTransactionSchema.index({ conversionId: 1 });

// Virtual for total fees
conversionTransactionSchema.virtual('totalFees').get(function() {
  return (this.fees.exchangeFee || 0) + 
         (this.fees.networkFee || 0) + 
         (this.fees.processingFee || 0);
});

// Virtual for net fiat amount (after fees)
conversionTransactionSchema.virtual('netFiatAmount').get(function() {
  return this.fiatAmount - this.totalFees;
});

// Methods
conversionTransactionSchema.methods.updateStatus = function(newStatus, note, metadata = {}) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || '',
    metadata
  });
  
  // Update timestamps based on status
  if (newStatus === 'completed') {
    this.completedAt = new Date();
  } else if (newStatus === 'failed') {
    this.failedAt = new Date();
  }
  
  return this.save();
};

conversionTransactionSchema.methods.setError = function(errorMessage, details = {}) {
  this.lastError = {
    message: errorMessage,
    timestamp: new Date(),
    details
  };
  return this.save();
};

conversionTransactionSchema.methods.incrementRetry = function() {
  this.retryCount += 1;
  return this.save();
};

conversionTransactionSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries && this.status === 'failed';
};

// Static methods
conversionTransactionSchema.statics.getByOrderId = function(orderId) {
  return this.findOne({ order: orderId }).sort({ createdAt: -1 });
};

conversionTransactionSchema.statics.getPendingConversions = function() {
  return this.find({ 
    status: { $in: ['pending', 'converting'] } 
  }).sort({ createdAt: 1 });
};

conversionTransactionSchema.statics.getStatsByExchange = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$exchange',
        totalConversions: { $sum: 1 },
        totalCryptoAmount: { $sum: '$cryptoAmount' },
        totalFiatAmount: { $sum: '$fiatAmount' },
        totalFees: { 
          $sum: { 
            $add: ['$fees.exchangeFee', '$fees.networkFee', '$fees.processingFee'] 
          }
        },
        avgConversionTime: { $avg: '$metadata.executionTime' }
      }
    }
  ]);
};

// Ensure virtuals are included in JSON output
conversionTransactionSchema.set('toJSON', { virtuals: true });
conversionTransactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ConversionTransaction', conversionTransactionSchema);
