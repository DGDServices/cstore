const mongoose = require('mongoose');

const currencyRateSchema = new mongoose.Schema({
  baseCurrency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true
  },
  targetCurrency: {
    type: String,
    required: true,
    uppercase: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  source: {
    type: String,
    enum: ['api', 'manual'],
    default: 'api'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
currencyRateSchema.index({ baseCurrency: 1, targetCurrency: 1, isActive: 1 });
currencyRateSchema.index({ lastUpdated: -1 });

// Static method to get latest rate
currencyRateSchema.statics.getLatestRate = async function(base, target) {
  return await this.findOne({
    baseCurrency: base.toUpperCase(),
    targetCurrency: target.toUpperCase(),
    isActive: true
  }).sort('-lastUpdated');
};

module.exports = mongoose.model('CurrencyRate', currencyRateSchema);
