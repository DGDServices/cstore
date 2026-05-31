const mongoose = require('mongoose');

const commissionRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: { type: String },
    applicableTo: {
      type: String,
      enum: ['all', 'category', 'seller_tier', 'product'],
      required: true,
      default: 'all'
    },
    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      }
    ],
    sellerTier: {
      type: String,
      enum: ['unverified', 'verified', 'business']
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'flat', 'tiered'],
      required: true,
      default: 'percentage'
    },
    commissionPct: {
      type: Number,
      min: 0,
      max: 100
    },
    flatFee: {
      type: Number,
      min: 0
    },
    tiers: [
      {
        upToAmount: { type: Number },
        commissionPct: { type: Number }
      }
    ],
    minFee: { type: Number, default: 0 },
    maxFee: { type: Number },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

commissionRuleSchema.index({ applicableTo: 1, isActive: 1 });
commissionRuleSchema.index({ priority: -1 });

module.exports = mongoose.model('CommissionRule', commissionRuleSchema);
