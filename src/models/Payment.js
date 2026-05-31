const mongoose = require('mongoose');
const { ALL_SUPPORTED_CRYPTO_SYMBOLS } = require('../config/cryptocurrencies');

const paymentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true
  },
  cryptocurrency: {
    type: String,
    required: true,
    enum: ALL_SUPPORTED_CRYPTO_SYMBOLS
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  amountUSD: {
    type: Number,
    required: true,
    min: 0
  },
  fromAddress: String,
  toAddress: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'expired'],
    default: 'pending'
  },
  confirmations: {
    type: Number,
    default: 0
  },
  blockNumber: Number,
  blockHash: String,
  confirmedAt: Date,
  verificationAttempts: {
    type: Number,
    default: 0
  },
  lastVerificationAt: Date
}, {
  timestamps: true
});

// Index for efficient queries
paymentSchema.index({ order: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
