const mongoose = require('mongoose');

const legalDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['terms_of_service', 'privacy_policy', 'risk_disclosure', 'aml_policy', 'cookie_policy'],
    required: true
  },
  version: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  effectiveDate: {
    type: Date,
    required: true
  },
  expiryDate: Date,
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft'
  },
  jurisdiction: String,
  language: {
    type: String,
    default: 'en'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date
}, {
  timestamps: true
});

// Indexes for efficient queries
legalDocumentSchema.index({ type: 1, version: 1 });
legalDocumentSchema.index({ status: 1 });
legalDocumentSchema.index({ effectiveDate: -1 });

module.exports = mongoose.model('LegalDocument', legalDocumentSchema);
