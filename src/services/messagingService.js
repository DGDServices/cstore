const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const logger = require('../utils/logger');

let contentModerationService;
try {
  contentModerationService = require('./contentModerationService');
} catch (e) {
  logger.warn('contentModerationService not available for messagingService');
}

class MessagingService {
  async getOrCreateConversation(participants, type = 'c2c_inquiry', relatedData = {}) {
    const participantIds = participants.map(p => p.toString()).sort();

    const query = {
      participants: { $all: participantIds, $size: participantIds.length }
    };
    if (relatedData.listingId) query.relatedListing = relatedData.listingId;
    if (relatedData.auctionId) query.relatedAuction = relatedData.auctionId;

    let conversation = await Conversation.findOne(query);
    if (conversation) return { conversation, isNew: false };

    conversation = await Conversation.create({
      participants,
      type,
      relatedListing: relatedData.listingId,
      relatedAuction: relatedData.auctionId,
      relatedOffer: relatedData.offerId
    });

    return { conversation, isNew: true };
  }

  async sendMessage(conversationId, senderId, content, contentType = 'text', metadata = {}) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }
    if (!conversation.isParticipant(senderId)) {
      const err = new Error('Not authorized to send messages in this conversation');
      err.statusCode = 403;
      throw err;
    }
    if (conversation.blockedBy && conversation.blockedBy.some(b => b.toString() === senderId.toString())) {
      const err = new Error('You are blocked from this conversation');
      err.statusCode = 403;
      throw err;
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      content,
      contentType,
      metadata
    });

    // Fire-and-forget content moderation for text messages
    if (contentType === 'text' && contentModerationService) {
      contentModerationService.moderateContent(
        'message',
        message._id,
        { text: content },
        senderId
      ).catch(err => logger.error('Content moderation error for message:', err));
    }

    await Conversation.findByIdAndUpdate(conversationId, {
      $inc: { messageCount: 1 },
      lastMessage: { content, sender: senderId, sentAt: new Date() }
    });

    return message;
  }

  async getConversation(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'name')
      .populate('relatedListing')
      .populate('relatedAuction');

    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }
    if (!conversation.isParticipant(userId)) {
      const err = new Error('Not authorized to view this conversation');
      err.statusCode = 403;
      throw err;
    }

    return conversation;
  }

  async getConversations(userId, page = 1, limit = 20) {
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = {
      participants: userId,
      archivedBy: { $ne: userId }
    };

    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .sort({ 'lastMessage.sentAt': -1 })
        .skip(skip)
        .limit(limit)
        .populate('participants', 'name'),
      Conversation.countDocuments(query)
    ]);

    return { conversations, total, page, limit };
  }

  async getMessages(conversationId, userId, page = 1, limit = 30, before) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }
    if (!conversation.isParticipant(userId)) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }

    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 30;
    void parsedPage; // page-based cursor reserved for future use; current impl uses before-cursor pagination

    const query = { conversation: conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit + 1); // fetch one extra to detect hasMore

    const hasMore = messages.length > parsedLimit;
    const result = hasMore ? messages.slice(0, parsedLimit) : messages;

    // Mark messages as read by this user (fire-and-forget)
    const unreadIds = result
      .filter(m => !m.readBy.some(r => r.user && r.user.toString() === userId.toString()))
      .map(m => m._id);

    if (unreadIds.length > 0) {
      Message.updateMany(
        { _id: { $in: unreadIds } },
        { $addToSet: { readBy: { user: userId, readAt: new Date() } }, $set: { isRead: true, readAt: new Date() } }
      ).catch(err => logger.error('Failed to mark messages as read:', err));
    }

    return { messages: result, hasMore };
  }

  async markAsRead(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }
    if (!conversation.isParticipant(userId)) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }

    const result = await Message.updateMany(
      {
        conversation: conversationId,
        'readBy.user': { $ne: userId }
      },
      {
        $addToSet: { readBy: { user: userId, readAt: new Date() } },
        $set: { isRead: true, readAt: new Date() }
      }
    );

    return { marked: result.modifiedCount || result.nModified || 0 };
  }

  async archiveConversation(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }
    if (!conversation.isParticipant(userId)) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      { $addToSet: { archivedBy: userId } },
      { new: true }
    );

    return updated;
  }

  async blockUserInConversation(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }
    if (!conversation.isParticipant(userId)) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      { $addToSet: { blockedBy: userId } },
      { new: true }
    );

    return updated;
  }

  async deleteMessage(messageId, userId) {
    const message = await Message.findById(messageId);
    if (!message) {
      const err = new Error('Message not found');
      err.statusCode = 404;
      throw err;
    }
    if (message.sender.toString() !== userId.toString()) {
      const err = new Error('Not authorized to delete this message');
      err.statusCode = 403;
      throw err;
    }

    // Soft delete — content preserved for moderation audit
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    return message;
  }
}

module.exports = new MessagingService();
