const mongoose = require('mongoose');

const complianceCaseSchema = new mongoose.Schema({
  caseNumber: {
    type: String,
    unique: true,
    required: true
  },
  type: {
    type: String,
    enum: ['KYC', 'AML', 'SAR', 'CTR', 'SANCTIONS', 'GDPR', 'OTHER'],
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'investigating', 'pending_decision', 'resolved', 'closed'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  description: {
    type: String,
    required: true
  },
  findings: String,
  actions: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: Date,
    notes: String
  }],
  relatedAlerts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AMLAlert'
  }],
  resolution: {
    outcome: String,
    details: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },
  dueDate: Date
}, {
  timestamps: true
});

// Auto-generate case number
complianceCaseSchema.pre('save', async function(next) {
  if (!this.caseNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      createdAt: { $gte: new Date(year, 0, 1) }
    });
    this.caseNumber = `CASE-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Indexes for efficient queries
complianceCaseSchema.index({ caseNumber: 1 });
complianceCaseSchema.index({ type: 1 });
complianceCaseSchema.index({ status: 1 });
complianceCaseSchema.index({ priority: 1 });
complianceCaseSchema.index({ assignedTo: 1 });
complianceCaseSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ComplianceCase', complianceCaseSchema);
