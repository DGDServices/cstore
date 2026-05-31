const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String },
  alt: { type: String }
}, { _id: false });

const lotItemSchema = new mongoose.Schema({
  description: { type: String },
  quantity: { type: Number },
  images: [{ type: String }]
}, { _id: false });

const shippingOptionSchema = new mongoose.Schema({
  method: { type: String },
  price: { type: Number },
  estimatedDays: { type: Number },
  carrier: { type: String }
}, { _id: false });

const bidIncrementEntrySchema = new mongoose.Schema({
  upToAmount: { type: Number },
  increment: { type: Number }
}, { _id: false });

const auctionSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller'
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
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
  images: [imageSchema],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  condition: {
    type: String,
    enum: ['new', 'like_new', 'good', 'fair', 'parts_only'],
    default: 'new'
  },
  auctionType: {
    type: String,
    enum: ['english', 'dutch', 'reserve', 'bin_hybrid', 'flash', 'lot'],
    required: true,
    default: 'english'
  },
  startingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  currentPrice: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  reservePrice: {
    type: Number,
    min: 0,
    default: null
  },
  reserveMet: {
    type: Boolean,
    default: false
  },
  buyItNowPrice: {
    type: Number,
    min: 0,
    default: null
  },
  binPurchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  binPurchasedAt: {
    type: Date
  },
  bidIncrement: {
    type: Number,
    default: 1
  },
  bidIncrementTable: [bidIncrementEntrySchema],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  originalEndTime: {
    type: Date
  },
  extensionCount: {
    type: Number,
    default: 0
  },
  extensionMinutes: {
    type: Number,
    default: 5
  },
  antiSnipingWindow: {
    type: Number,
    default: 2
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'ended', 'cancelled', 'sold'],
    default: 'draft'
  },
  winnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  winningBidId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid'
  },
  winningAmount: {
    type: Number
  },
  totalBids: {
    type: Number,
    default: 0
  },
  uniqueBidders: {
    type: Number,
    default: 0
  },
  watcherCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lotItems: [lotItemSchema],
  shippingOptions: [shippingOptionSchema],
  allowedBidders: {
    type: String,
    enum: ['all', 'verified_only', 'invite_only'],
    default: 'all'
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
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

auctionSchema.index({ status: 1, endTime: 1 });
auctionSchema.index({ seller: 1, status: 1 });
auctionSchema.index({ category: 1, status: 1 });
auctionSchema.index({ endTime: 1 });
auctionSchema.index({ moderationStatus: 1, status: 1 });

auctionSchema.virtual('isActive').get(function () {
  const now = new Date();
  return this.status === 'active' && now >= this.startTime && now <= this.endTime;
});

auctionSchema.virtual('timeRemaining').get(function () {
  return Math.max(0, this.endTime - Date.now());
});

auctionSchema.virtual('hasReserve').get(function () {
  return this.reservePrice != null && this.reservePrice > 0;
});

auctionSchema.methods.shouldExtend = function (bidTime) {
  const windowMs = this.antiSnipingWindow * 60 * 1000;
  return (this.endTime - bidTime) <= windowMs;
};

auctionSchema.methods.extendAuction = function () {
  if (!this.originalEndTime) {
    this.originalEndTime = this.endTime;
  }
  this.endTime = new Date(this.endTime.getTime() + this.extensionMinutes * 60 * 1000);
  this.extensionCount += 1;
  return this.endTime;
};

auctionSchema.pre('save', function (next) {
  if (this.startTime >= this.endTime) {
    return next(new Error('End time must be after start time'));
  }
  next();
});

module.exports = mongoose.model('Auction', auctionSchema);
