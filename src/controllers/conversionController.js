const conversionService = require('../services/conversionService');
const riskService = require('../services/riskService');
const logger = require('../utils/logger');

/**
 * Conversion Controller
 * Handles HTTP requests for conversion operations
 */

/**
 * Initiate a new conversion
 * POST /api/conversions/initiate
 */
exports.initiateConversion = async (req, res) => {
  try {
    const { orderId, fiatCurrency, exchange } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    const options = {
      fiatCurrency: fiatCurrency || 'USD',
      exchange: exchange,
      initiatedBy: req.user?._id
    };

    const conversion = await conversionService.initiateConversion(orderId, options);

    res.status(201).json({
      success: true,
      message: 'Conversion initiated successfully',
      data: conversion
    });
  } catch (error) {
    logger.error('Failed to initiate conversion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get conversion status
 * GET /api/conversions/:id/status
 */
exports.getConversionStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const status = await conversionService.getConversionStatus(id);

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get conversion status:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Approve a conversion
 * POST /api/conversions/:id/approve
 */
exports.approveConversion = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can approve conversions'
      });
    }

    const conversion = await conversionService.approveConversion(
      id,
      req.user._id,
      comment
    );

    res.status(200).json({
      success: true,
      message: 'Conversion approved successfully',
      data: conversion
    });
  } catch (error) {
    logger.error('Failed to approve conversion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Reject a conversion
 * POST /api/conversions/:id/reject
 */
exports.rejectConversion = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can reject conversions'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    const conversion = await conversionService.rejectConversion(
      id,
      req.user._id,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Conversion rejected successfully',
      data: conversion
    });
  } catch (error) {
    logger.error('Failed to reject conversion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get conversion history
 * GET /api/conversions/history
 */
exports.getConversionHistory = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      exchange: req.query.exchange,
      cryptocurrency: req.query.cryptocurrency,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    const result = await conversionService.getConversionHistory(filters, options);

    res.status(200).json({
      success: true,
      data: result.conversions,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Failed to get conversion history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get conversion statistics
 * GET /api/conversions/stats
 */
exports.getConversionStats = async (req, res) => {
  try {
    const startDate = req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate || new Date();

    const stats = await conversionService.getConversionStats(startDate, endDate);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get conversion stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get pending approvals
 * GET /api/conversions/pending-approvals
 */
exports.getPendingApprovals = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can view pending approvals'
      });
    }

    const pending = await conversionService.getPendingApprovals();

    res.status(200).json({
      success: true,
      data: pending
    });
  } catch (error) {
    logger.error('Failed to get pending approvals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Assess conversion risk
 * POST /api/conversions/assess-risk
 */
exports.assessRisk = async (req, res) => {
  try {
    const conversionData = req.body;

    const assessment = await riskService.assessConversionRisk(conversionData);

    res.status(200).json({
      success: true,
      data: assessment
    });
  } catch (error) {
    logger.error('Failed to assess risk:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
