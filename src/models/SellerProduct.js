const mongoose = require('mongoose');

const sellerProductSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    sellerSku: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    priceUSD: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    condition: {
      type: String,
      enum: ['new', 'like_new', 'good', 'fair', 'parts_only'],
      default: 'new'
    },
    conditionNotes: {
      type: String,
      maxlength: 500
    },
    fulfillmentType: {
      type: String,
      enum: ['fbm', 'fbp', 'pod'],
      default: 'fbm'
    },
    isActive: { type: Boolean, default: true },
    isBuyBoxWinner: { type: Boolean, default: false },
    buyBoxScore: { type: Number, default: 0 },
    buyBoxCalculatedAt: { type: Date },
    shippingOptions: [
      {
        carrier: { type: String },
        method: { type: String },
        price: { type: Number },
        estimatedDays: { type: Number }
      }
    ],
    handlingTime: { type: Number, default: 1 },
    images: [
      {
        url: { type: String },
        alt: { type: String }
      }
    ],
    notes: { type: String }
  },
  { timestamps: true }
);

sellerProductSchema.index({ seller: 1, product: 1 }, { unique: true });
sellerProductSchema.index({ product: 1, isActive: 1 });
sellerProductSchema.index({ isBuyBoxWinner: 1 });
sellerProductSchema.index({ seller: 1, isActive: 1 });

module.exports = mongoose.model('SellerProduct', sellerProductSchema);
