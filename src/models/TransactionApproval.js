const mongoose = require('mongoose');
const { NON_LIGHTNING_CRYPTO_SYMBOLS } = require('../config/cryptocurrencies');

const approvalSchema = new mongoose.Schema({
  signer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approved: {
    type: Boolean,
    required: true
  },
  signature: String,
  comment: String,
  approvedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const transactionApprovalSchema = new mongoose.Schema({
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultiSigWallet',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  transactionHash: String,
  cryptocurrency: {
    type: String,
    required: true,
    enum: NON_LIGHTNING_CRYPTO_SYMBOLS
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  toAddress: {
    type: String,
    required: true
  },
  fromAddress: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'executed', 'expired'],
    default: 'pending'
  },
  approvals: [approvalSchema],
  requiredApprovals: {
    type: Number,
    required: true,
    min: 2
  },
  description: String,
  metadata: {
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    expiresAt: Date,
    executedAt: Date,
    rejectionReason: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
transactionApprovalSchema.index({ wallet: 1, status: 1 });
transactionApprovalSchema.index({ order: 1 });
transactionApprovalSchema.index({ status: 1, createdAt: -1 });
transactionApprovalSchema.index({ 'approvals.signer': 1 });

// Virtual to get approval count
transactionApprovalSchema.virtual('approvalCount').get(function() {
  return this.approvals.filter(a => a.approved).length;
});

// Virtual to check if fully approved
transactionApprovalSchema.virtual('isFullyApproved').get(function() {
  return this.approvalCount >= this.requiredApprovals;
});

// Method to check if user has already approved
transactionApprovalSchema.methods.hasUserApproved = function(userId) {
  return this.approvals.some(approval => 
    approval.signer.toString() === userId.toString()
  );
};

// Method to add approval
transactionApprovalSchema.methods.addApproval = function(userId, approved, signature = null, comment = null) {
  if (this.hasUserApproved(userId)) {
    throw new Error('User has already provided approval for this transaction');
  }
  
  this.approvals.push({
    signer: userId,
    approved,
    signature,
    comment,
    approvedAt: new Date()
  });
  
  // Update status based on approvals
  if (!approved) {
    this.status = 'rejected';
    this.metadata.rejectionReason = comment || 'Transaction rejected by signer';
  } else if (this.approvalCount >= this.requiredApprovals) {
    this.status = 'approved';
  }
  
  return this;
};

// Ensure virtuals are included in JSON output
transactionApprovalSchema.set('toJSON', { virtuals: true });
transactionApprovalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TransactionApproval', transactionApprovalSchema);
