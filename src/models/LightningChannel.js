const mongoose = require('mongoose');

const lightningChannelSchema = new mongoose.Schema({
  channelId: {
    type: String,
    required: true,
    unique: true
  },
  remotePubkey: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 0
  },
  localBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  remoteBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'closing', 'closed', 'force-closing'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  fundingTxId: String,
  fundingOutputIndex: Number,
  closeHeight: Number,
  closingTxId: String,
  unsettledBalance: {
    type: Number,
    default: 0
  },
  totalSatoshisSent: {
    type: Number,
    default: 0
  },
  totalSatoshisReceived: {
    type: Number,
    default: 0
  },
  numUpdates: {
    type: Number,
    default: 0
  },
  pendingHtlcs: [{
    incoming: Boolean,
    amount: Number,
    hashLock: String,
    expirationHeight: Number
  }],
  metadata: {
    alias: String,
    color: String,
    features: [Number]
  },
  lastUpdatedAt: Date
}, {
  timestamps: true
});

// Index for efficient queries
lightningChannelSchema.index({ channelId: 1 });
lightningChannelSchema.index({ status: 1 });
lightningChannelSchema.index({ isActive: 1 });

// Virtual for available balance
lightningChannelSchema.virtual('availableBalance').get(function() {
  return this.localBalance - this.unsettledBalance;
});

// Method to update balances
lightningChannelSchema.methods.updateBalances = function(localBalance, remoteBalance) {
  this.localBalance = localBalance;
  this.remoteBalance = remoteBalance;
  this.lastUpdatedAt = new Date();
};

module.exports = mongoose.model('LightningChannel', lightningChannelSchema);
