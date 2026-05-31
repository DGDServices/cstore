const mongoose = require('mongoose');

const offerEntrySchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  message: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'countered', 'expired', 'withdrawn'],
    default: 'pending'
  },
  respondedAt: { type: Date },
  expiresAt: { type: Date },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

offerEntrySchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    const fortyEightHours = 48 * 60 * 60 * 1000;
    this.expiresAt = new Date(Date.now() + fortyEightHours);
  }
  next();
});

const offerSchema = new mongoose.Schema({
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'C2CListing',
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    // denormalized for faster queries
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  offerChain: [offerEntrySchema],
  currentAmount: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['open', 'accepted', 'rejected', 'withdrawn', 'expired'],
    default: 'open'
  },
  acceptedAt: { type: Date },
  acceptedAmount: { type: Number },
  createdOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

offerSchema.index({ listing: 1, status: 1 });
offerSchema.index({ buyer: 1, status: 1 });
offerSchema.index({ seller: 1, status: 1 });

offerSchema.methods.getLatestOffer = function () {
  return this.offerChain[this.offerChain.length - 1];
};

offerSchema.methods.canCounter = function (userId) {
  const latest = this.getLatestOffer();
  if (!latest) return false;
  return latest.status === 'pending' && latest.from.toString() !== userId.toString();
};

module.exports = mongoose.model('Offer', offerSchema);
