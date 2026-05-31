const mongoose = require('mongoose');
const { ALL_SUPPORTED_CRYPTO_SYMBOLS } = require('../config/cryptocurrencies');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
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
  priceUSD: {
    type: Number,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerEmail: {
    type: String,
    required: [true, 'Customer email is required'],
    lowercase: true,
    trim: true
  },
  items: [orderItemSchema],
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPriceUSD: {
    type: Number,
    required: true,
    min: 0
  },
  displayCurrency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  displayPrice: {
    type: Number,
    min: 0
  },
  exchangeRate: {
    type: Number,
    min: 0
  },
  cryptocurrency: {
    type: String,
    required: true,
    enum: ALL_SUPPORTED_CRYPTO_SYMBOLS
  },
  paymentAddress: {
    type: String,
    required: true
  },
  escrow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Escrow'
  },
  transactionHash: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  trackingNumber: String,
  notes: String,
  paymentMethod: {
    type: String,
    enum: ['On-chain', 'Lightning Network'],
    default: 'On-chain'
  },
  paidAt: Date
}, {
  timestamps: true
});

// Index for efficient queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ customerEmail: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ transactionHash: 1 });

module.exports = mongoose.model('Order', orderSchema);
