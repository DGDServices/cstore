const mongoose = require('mongoose');

const kycVerificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_review', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  personalInfo: {
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    nationality: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  documents: [{
    type: {
      type: String,
      enum: ['passport', 'drivers_license', 'national_id', 'proof_of_address']
    },
    documentNumber: String,
    expiryDate: Date,
    uploadedFile: String,
    verificationStatus: String,
    verifiedAt: Date
  }],
  verificationMethod: {
    type: String,
    enum: ['manual', 'automated', 'video_call']
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  rejectionReason: String,
  notes: String,
  expiryDate: Date,
  provider: {
    type: String,
    enum: ['jumio', 'onfido', 'sumsub', 'manual']
  },
  providerReference: String,
  providerData: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Index for efficient queries
kycVerificationSchema.index({ user: 1 });
kycVerificationSchema.index({ status: 1 });
kycVerificationSchema.index({ riskLevel: 1 });
kycVerificationSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('KYCVerification', kycVerificationSchema);
