const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: [true, 'Answer text is required'],
    maxlength: [1000, 'Answer cannot exceed 1000 characters']
  },
  isSellerOrAdmin: {
    type: Boolean,
    default: false
  },
  helpfulCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const productQuestionSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: String,
    required: [true, 'Question text is required'],
    maxlength: [500, 'Question cannot exceed 500 characters']
  },
  answers: [answerSchema],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  helpfulCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
productQuestionSchema.index({ product: 1, createdAt: -1 });
productQuestionSchema.index({ user: 1, createdAt: -1 });
productQuestionSchema.index({ status: 1 });

module.exports = mongoose.model('ProductQuestion', productQuestionSchema);
