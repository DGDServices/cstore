const { asyncHandler, AppError } = require('../middleware/errorHandler');
const messagingService = require('../services/messagingService');

exports.getConversations = asyncHandler(async (req, res, next) => {
  const { page, limit } = req.query;
  const result = await messagingService.getConversations(req.user.id, page, limit);
  res.json({
    success: true,
    count: result.conversations.length,
    total: result.total,
    page: result.page,
    limit: result.limit,
    data: result.conversations
  });
});

exports.getConversation = asyncHandler(async (req, res, next) => {
  const conversation = await messagingService.getConversation(req.params.id, req.user.id);
  res.json({ success: true, data: conversation });
});

exports.createConversation = asyncHandler(async (req, res, next) => {
  const { participantId, type, listingId, auctionId } = req.body;
  if (!participantId) return next(new AppError('participantId is required', 400));

  const relatedData = {};
  if (listingId) relatedData.listingId = listingId;
  if (auctionId) relatedData.auctionId = auctionId;

  const { conversation, isNew } = await messagingService.getOrCreateConversation(
    [req.user.id, participantId],
    type || 'c2c_inquiry',
    relatedData
  );

  res.status(isNew ? 201 : 200).json({ success: true, data: conversation });
});

exports.getMessages = asyncHandler(async (req, res, next) => {
  const { page, limit, before } = req.query;
  const result = await messagingService.getMessages(req.params.id, req.user.id, page, limit, before);
  res.json({
    success: true,
    count: result.messages.length,
    hasMore: result.hasMore,
    data: result.messages
  });
});

exports.sendMessage = asyncHandler(async (req, res, next) => {
  const { content, contentType } = req.body;
  if (!content) return next(new AppError('content is required', 400));
  const message = await messagingService.sendMessage(
    req.params.id,
    req.user.id,
    content,
    contentType || 'text',
    { ip: req.ip }
  );
  res.status(201).json({ success: true, data: message });
});

exports.markAsRead = asyncHandler(async (req, res, next) => {
  const result = await messagingService.markAsRead(req.params.id, req.user.id);
  res.json({ success: true, data: result });
});

exports.archiveConversation = asyncHandler(async (req, res, next) => {
  const conversation = await messagingService.archiveConversation(req.params.id, req.user.id);
  res.json({ success: true, data: conversation });
});

exports.deleteMessage = asyncHandler(async (req, res, next) => {
  const message = await messagingService.deleteMessage(req.params.messageId, req.user.id);
  res.json({ success: true, data: message });
});
