const mongoose = require('mongoose');

const checkSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['photodna', 'aws_rekognition', 'azure_content_safety', 'openai_moderation', 'perspective_api', 'keyword_blocklist', 'phash', 'internal_rules'],
    required: true
  },
  result: {
    type: String,
    enum: ['pass', 'fail', 'review', 'error'],
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  categories: [String],
  rawResponse: mongoose.Schema.Types.Mixed,
  checkedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const contentModerationLogSchema = new mongoose.Schema({
  contentType: {
    type: String,
    enum: ['listing', 'image', 'message', 'review', 'question', 'profile'],
    required: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  contentRef: String,
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  checks: [checkSchema],
  disposition: {
    type: String,
    enum: ['approved', 'rejected', 'pending_review', 'escalated'],
    default: 'pending_review'
  },
  dispositionReason: String,
  dispositionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  dispositionAt: Date,
  csam: {
    type: Boolean,
    default: false
  },
  ncmecReported: {
    type: Boolean,
    default: false
  },
  ncmecReportId: String,
  legalHold: {
    type: Boolean,
    default: false
  },
  legalHoldReason: String,
  evidencePreserved: {
    type: Boolean,
    default: false
  },
  evidencePath: String,
  appealedAt: Date,
  appealReason: String,
  appealResolution: {
    type: String,
    enum: ['upheld', 'overturned', null],
    default: null
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

contentModerationLogSchema.index({ contentType: 1, contentId: 1 });
contentModerationLogSchema.index({ disposition: 1 });
contentModerationLogSchema.index({ submittedBy: 1 });
contentModerationLogSchema.index({ csam: 1 });
contentModerationLogSchema.index({ ncmecReported: 1 });
contentModerationLogSchema.index({ legalHold: 1 });
contentModerationLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContentModerationLog', contentModerationLogSchema);
