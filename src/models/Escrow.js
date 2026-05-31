const mongoose = require('mongoose');
const { ALL_SUPPORTED_CRYPTO_SYMBOLS } = require('../config/cryptocurrencies');

/**
 * Milestone schema for milestone-based escrow releases
 */
const milestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'disputed', 'released'],
    default: 'pending'
  },
  completedAt: Date,
  releasedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: true, timestamps: true });

/**
 * Release condition schema for automated releases
 */
const releaseConditionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['time_based', 'milestone_based', 'mutual_agreement', 'delivery_confirmation', 'inspection_period'],
    required: true
  },
  value: mongoose.Schema.Types.Mixed, // Flexible for different condition types
  met: {
    type: Boolean,
    default: false
  },
  metAt: Date
}, { _id: false });

/**
 * Dispute schema for handling escrow disputes
 */
const disputeSchema = new mongoose.Schema({
  filedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  evidence: [{
    type: String, // URLs to uploaded evidence files
    url: String,
    uploadedAt: Date
  }],
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'closed'],
    default: 'open'
  },
  resolution: {
    type: String,
    enum: ['buyer_favor', 'seller_favor', 'partial_refund', 'custom'],
    default: null
  },
  resolutionDetails: String,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date
}, { _id: true, timestamps: true });

/**
 * Transaction fee schema
 */
const feeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['platform', 'blockchain', 'dispute'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  percentage: Number,
  paidBy: {
    type: String,
    enum: ['buyer', 'seller', 'split'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'collected', 'waived'],
    default: 'pending'
  }
}, { _id: false });

/**
 * Main Escrow schema
 */
const escrowSchema = new mongoose.Schema({
  // Parties involved
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Related resources
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  multiSigWallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultiSigWallet'
  },
  
  // Escrow details
  title: {
    type: String,
    required: [true, 'Escrow title is required'],
    trim: true
  },
  description: String,
  
  // Financial details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  cryptocurrency: {
    type: String,
    required: true,
    enum: ALL_SUPPORTED_CRYPTO_SYMBOLS
  },
  amountUSD: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Payment addresses
  depositAddress: {
    type: String,
    required: true
  },
  releaseAddress: String,
  refundAddress: String,
  
  // Transaction tracking
  depositTransactionHash: String,
  releaseTransactionHash: String,
  refundTransactionHash: String,
  
  // Status management
  status: {
    type: String,
    enum: ['created', 'funded', 'active', 'completed', 'disputed', 'refunded', 'cancelled', 'expired'],
    default: 'created'
  },
  
  // Release conditions
  releaseConditions: [releaseConditionSchema],
  releaseType: {
    type: String,
    enum: ['automatic', 'manual', 'milestone_based', 'time_based', 'mutual'],
    required: true
  },
  
  // Milestones for milestone-based escrow
  milestones: [milestoneSchema],
  
  // Dispute handling
  disputes: [disputeSchema],
  
  // Fees
  fees: [feeSchema],
  totalFees: {
    type: Number,
    default: 0
  },
  
  // Multi-signature support for high-value transactions
  requiresMultiSig: {
    type: Boolean,
    default: false
  },
  multiSigApprovals: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    action: {
      type: String,
      enum: ['release', 'refund', 'dispute_resolution']
    },
    approved: Boolean,
    signature: String,
    approvedAt: Date
  }],
  requiredApprovals: {
    type: Number,
    default: 1
  },
  
  // Important dates
  fundedAt: Date,
  releasedAt: Date,
  refundedAt: Date,
  expiresAt: Date,
  
  // Metadata
  metadata: {
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    terms: String, // Terms and conditions agreed upon
    notes: String,
    inspectionPeriodDays: {
      type: Number,
      default: 0
    },
    autoReleaseAfterDays: Number
  },
  
  // Audit trail
  history: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    details: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
escrowSchema.index({ buyer: 1, status: 1 });
escrowSchema.index({ seller: 1, status: 1 });
escrowSchema.index({ order: 1 });
escrowSchema.index({ status: 1, createdAt: -1 });
escrowSchema.index({ depositTransactionHash: 1 });
escrowSchema.index({ expiresAt: 1, status: 1 });
escrowSchema.index({ multiSigWallet: 1 });

// Virtual to check if all release conditions are met
escrowSchema.virtual('allConditionsMet').get(function() {
  if (!this.releaseConditions || this.releaseConditions.length === 0) {
    return false;
  }
  return this.releaseConditions.every(condition => condition.met);
});

// Virtual to check if escrow is expired
escrowSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt && this.status !== 'completed';
});

// Virtual to check if has active dispute
escrowSchema.virtual('hasActiveDispute').get(function() {
  return this.disputes.some(dispute => 
    dispute.status === 'open' || dispute.status === 'under_review'
  );
});

// Virtual to calculate total milestone amount
escrowSchema.virtual('totalMilestoneAmount').get(function() {
  if (!this.milestones || this.milestones.length === 0) {
    return 0;
  }
  return this.milestones.reduce((sum, milestone) => sum + milestone.amount, 0);
});

// Method to check if user is a party in the escrow
escrowSchema.methods.isParty = function(userId) {
  return this.buyer.toString() === userId.toString() || 
         this.seller.toString() === userId.toString();
};

// Method to check if user can perform an action
escrowSchema.methods.canPerformAction = function(userId, action) {
  const userIdStr = userId.toString();
  
  switch (action) {
    case 'release':
      return this.buyer.toString() === userIdStr && 
             (this.status === 'funded' || this.status === 'active');
    case 'refund':
      return (this.seller.toString() === userIdStr || this.buyer.toString() === userIdStr) && 
             (this.status === 'funded' || this.status === 'active');
    case 'dispute':
      return this.isParty(userId) && 
             (this.status === 'funded' || this.status === 'active');
    case 'cancel':
      return this.status === 'created' && 
             (this.buyer.toString() === userIdStr || this.seller.toString() === userIdStr);
    default:
      return false;
  }
};

// Method to add to history
escrowSchema.methods.addHistory = function(action, performedBy, details = null) {
  this.history.push({
    action,
    performedBy,
    details,
    timestamp: new Date()
  });
};

// Method to check if multi-sig approval is sufficient
escrowSchema.methods.hasRequiredApprovals = function(action) {
  if (!this.requiresMultiSig) {
    return true;
  }
  
  const approvals = this.multiSigApprovals.filter(
    approval => approval.action === action && approval.approved
  );
  
  return approvals.length >= this.requiredApprovals;
};

// Pre-save middleware to validate milestones
escrowSchema.pre('save', function(next) {
  if (this.releaseType === 'milestone_based' && this.milestones.length === 0) {
    return next(new Error('Milestone-based escrow must have at least one milestone'));
  }
  
  if (this.releaseType === 'milestone_based') {
    const totalMilestoneAmount = this.milestones.reduce(
      (sum, milestone) => sum + milestone.amount, 0
    );
    if (Math.abs(totalMilestoneAmount - this.amount) > 0.01) {
      return next(new Error('Total milestone amount must equal escrow amount'));
    }
  }
  
  next();
});

// Ensure virtuals are included in JSON output
escrowSchema.set('toJSON', { virtuals: true });
escrowSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Escrow', escrowSchema);
