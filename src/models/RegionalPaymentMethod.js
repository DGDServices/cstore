const mongoose = require('mongoose');

const regionalPaymentMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  },
  regions: [{
    type: String,
    uppercase: true
  }],
  countries: [{
    type: String,
    uppercase: true
  }],
  currencies: [{
    type: String,
    uppercase: true
  }],
  type: {
    type: String,
    enum: ['bank_transfer', 'card', 'digital_wallet', 'crypto', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  processingTime: {
    type: String,
    default: '1-3 business days'
  },
  fees: {
    fixed: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  provider: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
regionalPaymentMethodSchema.index({ regions: 1, isActive: 1 });
regionalPaymentMethodSchema.index({ countries: 1, isActive: 1 });
regionalPaymentMethodSchema.index({ currencies: 1, isActive: 1 });
regionalPaymentMethodSchema.index({ code: 1 });

module.exports = mongoose.model('RegionalPaymentMethod', regionalPaymentMethodSchema);
