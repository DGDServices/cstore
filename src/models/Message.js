const mongoose = require('mongoose');

const readByEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  readAt: { type: Date }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  contentType: {
    type: String,
    enum: ['text', 'image', 'offer_card', 'system'],
    default: 'text'
  },
  imageUrl: { type: String }, // for image messages
  offerRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer' // for offer_card messages
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: { type: Date },
  readBy: [readByEntrySchema],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: { type: Date },
  moderationResult: {
    type: String,
    enum: ['approved', 'rejected', 'pending', null],
    default: null
  },
  moderationLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContentModerationLog'
  },
  metadata: { type: mongoose.Schema.Types.Mixed }, // IP, device fingerprint
  retentionExpiry: { type: Date } // optional TTL field for data retention compliance
}, { timestamps: true });

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ isRead: 1, conversation: 1 });
messageSchema.index({ retentionExpiry: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Message', messageSchema);
