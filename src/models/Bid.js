const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  auction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    required: true
  },
  bidder: {
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
  maxProxyBid: {
    type: Number,
    min: 0,
    default: null
  },
  isProxy: {
    type: Boolean,
    default: false
  },
  isWinning: {
    type: Boolean,
    default: false
  },
  wasOutbid: {
    type: Boolean,
    default: false
  },
  outbidAt: {
    type: Date
  },
  outbidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'outbid', 'won', 'cancelled', 'retracted'],
    default: 'active'
  },
  retractionReason: {
    type: String
  },
  retractedAt: {
    type: Date
  },
  retractedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ipAddress: {
    type: String
  },
  deviceFingerprint: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

bidSchema.index({ auction: 1, amount: -1 });
bidSchema.index({ auction: 1, bidder: 1 });
bidSchema.index({ bidder: 1, status: 1 });
bidSchema.index({ auction: 1, isWinning: 1 });

module.exports = mongoose.model('Bid', bidSchema);
