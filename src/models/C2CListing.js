const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String },
  alt: { type: String }
}, { _id: false });

const locationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number],
    default: [0, 0] // [longitude, latitude]
  },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  postalCode: { type: String },
  displayAddress: { type: String } // shown to users (city, state only — no exact address)
}, { _id: false });

const c2cListingSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  // Max 20 images per listing
  images: [imageSchema],
  category: {
    type: String,
    required: true,
    enum: ['electronics', 'vehicles', 'furniture', 'clothing', 'sporting_goods', 'tools', 'collectibles', 'baby_kids', 'books_media', 'services', 'other']
  },
  condition: {
    type: String,
    required: true,
    enum: ['new', 'like_new', 'good', 'fair', 'parts_only']
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  isNegotiable: {
    type: Boolean,
    default: false
  },
  location: locationSchema,
  status: {
    type: String,
    enum: ['draft', 'active', 'pending_moderation', 'sold', 'expired', 'removed'],
    default: 'pending_moderation'
  },
  tier: {
    type: String,
    enum: ['basic', 'featured', 'premium'],
    default: 'basic'
  },
  tierPaidAt: { type: Date },
  tierExpiresAt: { type: Date },
  bumpCount: {
    type: Number,
    default: 0
  },
  lastBumpedAt: { type: Date },
  expiresAt: { type: Date },
  viewCount: {
    type: Number,
    default: 0
  },
  watcherCount: {
    type: Number,
    default: 0
  },
  offerCount: {
    type: Number,
    default: 0
  },
  preferredContactMethod: {
    type: String,
    enum: ['in_app', 'phone', 'email'],
    default: 'in_app'
  },
  phoneNumber: { type: String }, // shown only after buyer confirms safety tips
  phoneMaskEnabled: {
    type: Boolean,
    default: true // hide real number until confirmed
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'escrow', 'venmo', 'zelle', 'crypto', 'any'],
    default: 'any'
  },
  safeExchangePreferred: {
    type: Boolean,
    default: true
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  moderationLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContentModerationLog'
  },
  moderationRejectionReason: { type: String },
  tags: [{ type: String }],
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

c2cListingSchema.index({ location: '2dsphere' });
c2cListingSchema.index({ status: 1, moderationStatus: 1 });
c2cListingSchema.index({ seller: 1, status: 1 });
c2cListingSchema.index({ category: 1, status: 1 });
c2cListingSchema.index({ expiresAt: 1, status: 1 });
c2cListingSchema.index({ lastBumpedAt: -1, status: 1 });
c2cListingSchema.index({ title: 'text', description: 'text' });

c2cListingSchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    this.expiresAt = new Date(Date.now() + thirtyDays);
  }
  next();
});

module.exports = mongoose.model('C2CListing', c2cListingSchema);
