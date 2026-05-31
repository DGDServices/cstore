const mongoose = require('mongoose');

const prohibitedItemRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  ruleType: {
    type: String,
    enum: ['keyword', 'category', 'image_signature', 'seller_tier', 'price_anomaly'],
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  severity: {
    type: String,
    enum: ['warn', 'review', 'reject', 'ban'],
    required: true
  },
  keywords: [String],
  keywordMatchMode: {
    type: String,
    enum: ['any', 'all', 'regex'],
    default: 'any'
  },
  keywordCaseSensitive: {
    type: Boolean,
    default: false
  },
  categories: [String],
  imageSignatures: [String],
  sellerTierRequired: {
    type: String,
    enum: ['none', 'verified', 'business']
  },
  priceThresholdPct: Number,
  affectedCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

prohibitedItemRuleSchema.index({ ruleType: 1, enabled: 1 });
prohibitedItemRuleSchema.index({ severity: 1 });

module.exports = mongoose.model('ProhibitedItemRule', prohibitedItemRuleSchema);
