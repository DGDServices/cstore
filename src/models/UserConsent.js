const mongoose = require('mongoose');

const userConsentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  consentType: {
    type: String,
    enum: ['terms_of_service', 'privacy_policy', 'marketing', 'data_processing', 'cookies'],
    required: true
  },
  version: {
    type: String,
    required: true
  },
  granted: {
    type: Boolean,
    required: true
  },
  grantedAt: Date,
  revokedAt: Date,
  ipAddress: String,
  userAgent: String,
  method: {
    type: String,
    enum: ['web', 'api', 'email', 'other']
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
userConsentSchema.index({ user: 1, consentType: 1 });
userConsentSchema.index({ user: 1, version: 1 });
userConsentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('UserConsent', userConsentSchema);
