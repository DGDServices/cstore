const mongoose = require('mongoose');

const lightningInvoiceSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  paymentRequest: {
    type: String,
    required: true,
    unique: true
  },
  paymentHash: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  amountMsat: {
    type: Number,
    required: true,
    min: 0
  },
  amountUSD: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'expired', 'cancelled'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  paidAt: Date,
  preimage: String,
  settledIndex: Number,
  tokens: Number,
  secret: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
lightningInvoiceSchema.index({ paymentHash: 1 });
lightningInvoiceSchema.index({ status: 1, expiresAt: 1 });
lightningInvoiceSchema.index({ order: 1 });

// Virtual for checking if invoice is expired
lightningInvoiceSchema.virtual('isExpired').get(function() {
  return this.status === 'pending' && new Date() > this.expiresAt;
});

// Method to check and update expired status
lightningInvoiceSchema.methods.checkExpiration = function() {
  if (this.status === 'pending' && new Date() > this.expiresAt) {
    this.status = 'expired';
    return true;
  }
  return false;
};

module.exports = mongoose.model('LightningInvoice', lightningInvoiceSchema);
