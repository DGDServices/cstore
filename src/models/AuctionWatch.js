const mongoose = require('mongoose');

const auctionWatchSchema = new mongoose.Schema({
  auction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notifyOnOutbid: {
    type: Boolean,
    default: true
  },
  notifyOnEndingSoon: {
    type: Boolean,
    default: true
  },
  notifyOnWon: {
    type: Boolean,
    default: true
  },
  lastNotifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

auctionWatchSchema.index({ auction: 1, user: 1 }, { unique: true });
auctionWatchSchema.index({ user: 1 });

module.exports = mongoose.model('AuctionWatch', auctionWatchSchema);
