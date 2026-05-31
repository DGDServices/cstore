const { asyncHandler, AppError } = require('../middleware/errorHandler');
const ContentModerationLog = require('../models/ContentModerationLog');
const ProhibitedItemRule = require('../models/ProhibitedItemRule');
const contentModerationService = require('../services/contentModerationService');
const authorityReportingService = require('../services/authorityReportingService');

exports.getModerationQueue = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const data = await contentModerationService.getModerationQueue(page, limit);
  res.json({ success: true, data });
});

exports.getModerationLog = asyncHandler(async (req, res, next) => {
  const log = await ContentModerationLog
    .findById(req.params.id)
    .populate('submittedBy', 'name email')
    .populate('dispositionBy', 'name email');
  if (!log) {
    return next(new AppError('Moderation log not found', 404));
  }
  res.json({ success: true, data: log });
});

exports.reviewContent = asyncHandler(async (req, res, next) => {
  const { decision, reason } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    return next(new AppError('Decision must be "approved" or "rejected"', 400));
  }
  const log = await contentModerationService.reviewContent(req.params.id, decision, req.user.id, reason);
  if (!log) {
    return next(new AppError('Moderation log not found', 404));
  }
  res.json({ success: true, data: log });
});

exports.appealDecision = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  const log = await ContentModerationLog.findById(req.params.id);
  if (!log) {
    return next(new AppError('Moderation log not found', 404));
  }
  if (log.submittedBy && log.submittedBy.toString() !== req.user.id.toString()) {
    return next(new AppError('You are not authorized to appeal this decision', 403));
  }
  const updated = await contentModerationService.processAppeal(req.params.id, reason, req.user.id);
  res.json({ success: true, data: updated });
});

exports.getLegalHolds = asyncHandler(async (req, res) => {
  const data = await authorityReportingService.getLawEnforcementRequests();
  res.json({ success: true, data });
});

// Rate limit: 10 req/hour (apply rate limiter middleware at the router level)
exports.handleLERequest = asyncHandler(async (req, res) => {
  const apiKey = req.headers['x-le-api-key'];
  const evidencePackage = await authorityReportingService.handleLawEnforcementRequest(req.body, apiKey);
  res.json({ success: true, data: evidencePackage });
});

exports.getProhibitedItemRules = asyncHandler(async (req, res) => {
  const rules = await ProhibitedItemRule.find().sort({ createdAt: -1 });
  res.json({ success: true, data: rules });
});

exports.createProhibitedItemRule = asyncHandler(async (req, res) => {
  const rule = await ProhibitedItemRule.create({
    ...req.body,
    createdBy: req.user.id,
    lastModifiedBy: req.user.id
  });
  res.status(201).json({ success: true, data: rule });
});

exports.updateProhibitedItemRule = asyncHandler(async (req, res, next) => {
  const rule = await ProhibitedItemRule.findByIdAndUpdate(
    req.params.id,
    { ...req.body, lastModifiedBy: req.user.id },
    { new: true, runValidators: true }
  );
  if (!rule) {
    return next(new AppError('Rule not found', 404));
  }
  res.json({ success: true, data: rule });
});

exports.deleteProhibitedItemRule = asyncHandler(async (req, res, next) => {
  const rule = await ProhibitedItemRule.findByIdAndDelete(req.params.id);
  if (!rule) {
    return next(new AppError('Rule not found', 404));
  }
  res.json({ success: true, data: {} });
});
