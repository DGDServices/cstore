const mongoose = require('mongoose');

/**
 * ExchangeBalance Model
 * Tracks cryptocurrency and fiat balances across exchanges
 */
const exchangeBalanceSchema = new mongoose.Schema({
  // Exchange identifier
  exchange: {
    type: String,
    required: true,
    enum: ['coinbase', 'kraken', 'binance'],
    index: true
  },
  
  // Currency details
  currency: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  currencyType: {
    type: String,
    enum: ['crypto', 'fiat'],
    required: true
  },
  
  // Balance information
  available: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  reserved: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Sync information
  lastSync: {
    type: Date,
    default: Date.now,
    index: true
  },
  syncStatus: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },
  syncError: String,
  
  // Alert thresholds
  minBalance: {
    type: Number,
    default: 0
  },
  alertThreshold: {
    type: Number,
    default: 0
  },
  lowBalanceAlert: {
    type: Boolean,
    default: false
  },
  
  // Metadata
  metadata: {
    accountId: String,
    walletAddress: String,
    lastTransactionId: String,
    apiResponse: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound indexes
exchangeBalanceSchema.index({ exchange: 1, currency: 1 }, { unique: true });
exchangeBalanceSchema.index({ exchange: 1, currencyType: 1 });
exchangeBalanceSchema.index({ lowBalanceAlert: 1, exchange: 1 });

// Virtual for available percentage
exchangeBalanceSchema.virtual('availablePercentage').get(function() {
  if (this.total === 0) return 0;
  return (this.available / this.total) * 100;
});

// Methods
exchangeBalanceSchema.methods.updateBalance = function(available, reserved, total) {
  this.available = available;
  this.reserved = reserved;
  this.total = total || (available + reserved);
  this.lastSync = new Date();
  this.syncStatus = 'success';
  this.syncError = null;
  
  // Check for low balance alert
  if (this.alertThreshold > 0 && this.available < this.alertThreshold) {
    this.lowBalanceAlert = true;
  } else {
    this.lowBalanceAlert = false;
  }
  
  return this.save();
};

exchangeBalanceSchema.methods.reserve = function(amount) {
  if (amount > this.available) {
    throw new Error('Insufficient available balance');
  }
  this.available -= amount;
  this.reserved += amount;
  return this.save();
};

exchangeBalanceSchema.methods.release = function(amount) {
  if (amount > this.reserved) {
    throw new Error('Cannot release more than reserved amount');
  }
  this.reserved -= amount;
  this.available += amount;
  return this.save();
};

exchangeBalanceSchema.methods.deduct = function(amount) {
  if (amount > this.reserved) {
    throw new Error('Insufficient reserved balance');
  }
  this.reserved -= amount;
  this.total -= amount;
  return this.save();
};

exchangeBalanceSchema.methods.markSyncFailed = function(error) {
  this.syncStatus = 'failed';
  this.syncError = error;
  this.lastSync = new Date();
  return this.save();
};

// Static methods
exchangeBalanceSchema.statics.getBalance = function(exchange, currency) {
  return this.findOne({ exchange, currency });
};

exchangeBalanceSchema.statics.getExchangeBalances = function(exchange) {
  return this.find({ exchange }).sort({ currencyType: 1, currency: 1 });
};

exchangeBalanceSchema.statics.getLowBalanceAlerts = function() {
  return this.find({ lowBalanceAlert: true });
};

exchangeBalanceSchema.statics.getCryptoBalances = function() {
  return this.find({ currencyType: 'crypto' }).sort({ exchange: 1, currency: 1 });
};

exchangeBalanceSchema.statics.getFiatBalances = function() {
  return this.find({ currencyType: 'fiat' }).sort({ exchange: 1, currency: 1 });
};

exchangeBalanceSchema.statics.getTotalBalance = async function(currency) {
  const result = await this.aggregate([
    { $match: { currency } },
    {
      $group: {
        _id: '$currency',
        totalAvailable: { $sum: '$available' },
        totalReserved: { $sum: '$reserved' },
        totalBalance: { $sum: '$total' }
      }
    }
  ]);
  return result[0] || { totalAvailable: 0, totalReserved: 0, totalBalance: 0 };
};

// Ensure virtuals are included in JSON output
exchangeBalanceSchema.set('toJSON', { virtuals: true });
exchangeBalanceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ExchangeBalance', exchangeBalanceSchema);
