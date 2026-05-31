const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    businessName: {
      type: String,
      trim: true,
      maxlength: 200
    },
    businessType: {
      type: String,
      enum: ['individual', 'sole_proprietor', 'llc', 'corporation', 'partnership'],
      default: 'individual'
    },
    description: {
      type: String,
      maxlength: 2000
    },
    logo: { type: String },
    banner: { type: String },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },
    website: { type: String },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'suspended', 'banned'],
      default: 'unverified'
    },
    verificationSubmittedAt: { type: Date },
    verificationApprovedAt: { type: Date },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    kycLevel: {
      type: Number,
      default: 0
    },
    taxInfo: {
      taxId: { type: String },
      taxFormType: {
        type: String,
        enum: ['W-9', 'W-8BEN', 'W-8BEN-E', null]
      },
      taxFormUrl: { type: String },
      submittedAt: { type: Date }
    },
    payoutMethods: [
      {
        type: {
          type: String,
          enum: ['stripe', 'bank_transfer', 'crypto']
        },
        details: { type: mongoose.Schema.Types.Mixed },
        isPrimary: { type: Boolean, default: false }
      }
    ],
    stripeConnectAccountId: { type: String },
    performanceMetrics: {
      totalOrders: { type: Number, default: 0 },
      fulfilledOrders: { type: Number, default: 0 },
      cancelledOrders: { type: Number, default: 0 },
      lateShipments: { type: Number, default: 0 },
      orderDefectRate: { type: Number, default: 0 },
      lateShipmentRate: { type: Number, default: 0 },
      cancellationRate: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      lastCalculatedAt: { type: Date }
    },
    violations: [
      {
        type: { type: String },
        description: { type: String },
        issuedAt: { type: Date },
        issuedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        severity: {
          type: String,
          enum: ['warning', 'suspension', 'ban']
        }
      }
    ],
    strikeCount: { type: Number, default: 0 },
    isSuspended: { type: Boolean, default: false },
    suspendedUntil: { type: Date },
    suspensionReason: { type: String },
    returnPolicy: {
      type: String,
      maxlength: 1000
    },
    shipsFrom: {
      country: { type: String },
      state: { type: String },
      city: { type: String }
    },
    shippingCarriers: [{ type: String }],
    processingTime: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 3 },
      unit: { type: String, default: 'business_days' }
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      }
    ],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

sellerSchema.index({ verificationStatus: 1 });
sellerSchema.index({ isSuspended: 1 });
sellerSchema.index({ 'performanceMetrics.averageRating': 1 });

sellerSchema.virtual('isEligibleForBuyBox').get(function () {
  return (
    this.verificationStatus === 'verified' &&
    !this.isSuspended &&
    this.isActive &&
    this.performanceMetrics.orderDefectRate < 0.01 &&
    this.performanceMetrics.lateShipmentRate < 0.04
  );
});

module.exports = mongoose.model('Seller', sellerSchema);
