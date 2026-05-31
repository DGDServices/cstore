const mongoose = require('mongoose');

const sanctionsScreeningSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  screeningDate: {
    type: Date,
    default: Date.now
  },
  result: {
    type: String,
    enum: ['clear', 'potential_match', 'confirmed_match'],
    required: true
  },
  lists: [{
    name: String,
    source: {
      type: String,
      enum: ['OFAC', 'UN', 'EU', 'UK_HMT', 'OTHER']
    },
    matchScore: Number,
    matchDetails: mongoose.Schema.Types.Mixed
  }],
  action: {
    type: String,
    enum: ['allow', 'block', 'manual_review'],
    required: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: String,
  reviewedAt: Date,
  nextScreeningDate: Date
}, {
  timestamps: true
});

// Indexes for efficient queries
sanctionsScreeningSchema.index({ user: 1 });
sanctionsScreeningSchema.index({ screeningDate: -1 });
sanctionsScreeningSchema.index({ result: 1 });
sanctionsScreeningSchema.index({ action: 1 });

module.exports = mongoose.model('SanctionsScreening', sanctionsScreeningSchema);
