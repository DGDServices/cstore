const mongoose = require('mongoose');

const dataRetentionPolicySchema = new mongoose.Schema({
  dataType: {
    type: String,
    required: true,
    unique: true
  },
  retentionPeriodDays: {
    type: Number,
    required: true
  },
  description: String,
  legalBasis: String,
  deleteAfterExpiry: {
    type: Boolean,
    default: true
  },
  archiveBeforeDelete: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  lastReviewDate: Date,
  nextReviewDate: Date
}, {
  timestamps: true
});

// Indexes for efficient queries
dataRetentionPolicySchema.index({ dataType: 1 });
dataRetentionPolicySchema.index({ status: 1 });

module.exports = mongoose.model('DataRetentionPolicy', dataRetentionPolicySchema);
