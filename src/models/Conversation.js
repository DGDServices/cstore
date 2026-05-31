const mongoose = require('mongoose');

const lastMessageSchema = new mongoose.Schema({
  content: { type: String },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sentAt: { type: Date }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  type: {
    type: String,
    enum: ['c2c_inquiry', 'c2c_offer', 'support', 'auction_inquiry'],
    default: 'c2c_inquiry'
  },
  relatedListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'C2CListing'
  },
  relatedAuction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction'
  },
  relatedOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer'
  },
  lastMessage: lastMessageSchema,
  messageCount: {
    type: Number,
    default: 0
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  blockedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

conversationSchema.index({ participants: 1 });
conversationSchema.index({ relatedListing: 1 });
conversationSchema.index({ 'lastMessage.sentAt': -1 });

conversationSchema.methods.isParticipant = function (userId) {
  return this.participants.some(p => p.toString() === userId.toString());
};

module.exports = mongoose.model('Conversation', conversationSchema);
