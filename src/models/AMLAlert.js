const mongoose = require('mongoose');

const amlAlertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConversionTransaction'
  },
  type: {
    type: String,
    enum: [
      'CTR_REQUIRED',
      'SAR_REQUIRED',
      'POTENTIAL_STRUCTURING',
      'SANCTIONS_HIT',
      'HIGH_RISK_COUNTRY',
      'UNUSUAL_PATTERN',
      'RAPID_SUCCESSION',
      'LARGE_TRANSACTION'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'escalated', 'filed'],
    default: 'open'
  },
  description: String,
  details: mongoose.Schema.Types.Mixed,
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolution: {
    action: String,
    notes: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },
  filingReference: String,
  filedAt: Date
}, {
  timestamps: true
});

// Indexes for efficient queries
amlAlertSchema.index({ user: 1 });
amlAlertSchema.index({ transaction: 1 });
amlAlertSchema.index({ type: 1 });
amlAlertSchema.index({ severity: 1 });
amlAlertSchema.index({ status: 1 });
amlAlertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AMLAlert', amlAlertSchema);
