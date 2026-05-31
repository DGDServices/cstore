const ConversionTransaction = require('../models/ConversionTransaction');
const PrintifyOrder = require('../models/PrintifyOrder');
const Order = require('../models/Order');
const exchangeService = require('./exchangeService');
const RateCalculator = require('../utils/rateCalculator');
const RiskCalculator = require('../utils/riskCalculator');
const logger = require('../utils/logger');
const conversionConfig = require('../../config/conversion');

/**
 * Conversion Service
 * Manages crypto-to-fiat conversion workflow
 */
class ConversionService {
  constructor() {
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Initiate a new conversion
   */
  async initiateConversion(orderId, options = {}) {
    try {
      // Get the order
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Check if conversion already exists
      const existing = await ConversionTransaction.getByOrderId(orderId);
      if (existing && existing.status !== 'failed') {
        throw new Error('Conversion already exists for this order');
      }

      // Determine exchange to use
      const exchange = options.exchange || 
        await exchangeService.selectBestExchange(
          order.cryptocurrency,
          options.fiatCurrency || 'USD',
          order.totalPriceUSD
        );

      // Get current exchange rate
      const exchangeRate = await exchangeService.getExchangeRate(
        exchange,
        order.cryptocurrency,
        options.fiatCurrency || 'USD'
      );

      // Calculate conversion details
      const estimate = RateCalculator.estimateConversion(
        order.totalPrice,
        exchangeRate,
        exchange,
        order.cryptocurrency,
        options.fiatCurrency || 'USD'
      );

      // Calculate risk score
      const riskAnalysis = await RiskCalculator.calculateRiskScore({
        fiatAmount: estimate.grossFiatAmount,
        cryptocurrency: order.cryptocurrency,
        exchange,
        userId: order.user,
        volatility: options.volatility || 0
      });

      const riskLevel = RiskCalculator.determineRiskLevel(riskAnalysis.totalScore);

      // Check if approval is required
      const requiresApproval = RateCalculator.requiresApproval(
        estimate.grossFiatAmount,
        riskLevel
      );

      // Create conversion transaction
      const conversion = await ConversionTransaction.create({
        order: orderId,
        cryptoAmount: order.totalPrice,
        cryptocurrency: order.cryptocurrency,
        fiatAmount: estimate.grossFiatAmount,
        fiatCurrency: options.fiatCurrency || 'USD',
        exchangeRate: exchangeRate,
        exchange: exchange,
        status: requiresApproval ? 'pending' : 'pending',
        fees: {
          exchangeFee: estimate.fees.exchangeFee,
          networkFee: estimate.fees.networkFee,
          processingFee: estimate.fees.processingFee
        },
        riskLevel: riskLevel,
        requiresApproval: requiresApproval,
        initiatedBy: options.initiatedBy,
        metadata: {
          volatilityScore: riskAnalysis.totalScore,
          priceSlippage: 0,
          apiResponse: null
        }
      });

      await conversion.updateStatus('pending', 'Conversion initiated');

      logger.info(`Conversion initiated for order ${orderId}:`, {
        conversionId: conversion._id,
        amount: estimate.grossFiatAmount,
        exchange,
        requiresApproval
      });

      // If no approval required, add to processing queue
      if (!requiresApproval) {
        this.addToQueue(conversion._id);
      }

      return conversion;
    } catch (error) {
      logger.error('Failed to initiate conversion:', error);
      throw error;
    }
  }

  /**
   * Execute a conversion
   */
  async executeConversion(conversionId) {
    try {
      const conversion = await ConversionTransaction.findById(conversionId);
      if (!conversion) {
        throw new Error('Conversion not found');
      }

      // Check status
      if (conversion.status !== 'pending') {
        throw new Error(`Cannot execute conversion in status: ${conversion.status}`);
      }

      // Check approval requirement
      if (conversion.requiresApproval && !conversion.approvedBy) {
        throw new Error('Conversion requires approval');
      }

      // Update status to converting
      await conversion.updateStatus('converting', 'Executing conversion on exchange');

      // Get fresh exchange rate
      const currentRate = await exchangeService.getExchangeRate(
        conversion.exchange,
        conversion.cryptocurrency,
        conversion.fiatCurrency
      );

      // Check for slippage
      const slippage = RateCalculator.calculateSlippage(conversion.exchangeRate, currentRate);
      
      if (!RateCalculator.isSlippageAcceptable(conversion.exchangeRate, currentRate)) {
        await conversion.setError(`Excessive slippage: ${slippage.toFixed(2)}%`);
        await conversion.updateStatus('failed', 'Excessive price slippage');
        throw new Error('Excessive price slippage detected');
      }

      // Execute the conversion on the exchange
      const startTime = Date.now();
      const result = await exchangeService.executeConversion(
        conversion.exchange,
        conversion.cryptocurrency,
        conversion.fiatCurrency,
        conversion.cryptoAmount
      );
      const executionTime = Date.now() - startTime;

      // Update conversion with results
      conversion.conversionId = result.id || result.orderId || result.txId;
      conversion.metadata.executionTime = executionTime;
      conversion.metadata.priceSlippage = slippage;
      conversion.metadata.apiResponse = result;
      
      await conversion.updateStatus('completed', 'Conversion completed successfully');

      logger.info(`Conversion ${conversionId} completed successfully:`, {
        exchange: conversion.exchange,
        amount: conversion.fiatAmount,
        executionTime
      });

      // Create Printify order entry
      await this.createPrintifyOrder(conversion);

      return conversion;
    } catch (error) {
      logger.error(`Failed to execute conversion ${conversionId}:`, error);
      
      // Update conversion status
      const conversion = await ConversionTransaction.findById(conversionId);
      if (conversion) {
        await conversion.setError(error.message, { stack: error.stack });
        await conversion.updateStatus('failed', `Conversion failed: ${error.message}`);
        
        // Check if can retry
        if (conversion.canRetry()) {
          await conversion.incrementRetry();
          logger.info(`Will retry conversion ${conversionId} (attempt ${conversion.retryCount + 1})`);
          
          // Add to queue for retry with delay
          setTimeout(() => {
            this.addToQueue(conversionId);
          }, conversionConfig.processing.retryDelay);
        }
      }
      
      throw error;
    }
  }

  /**
   * Create Printify order after successful conversion
   */
  async createPrintifyOrder(conversion) {
    try {
      const order = await Order.findById(conversion.order);
      if (!order) {
        throw new Error('Original order not found');
      }

      // Create PrintifyOrder record
      const printifyOrder = await PrintifyOrder.create({
        originalOrder: conversion.order,
        conversion: conversion._id,
        products: [], // Will be populated when placing order
        shippingInfo: {
          firstName: order.shippingAddress?.firstName || 'Customer',
          lastName: order.shippingAddress?.lastName || '',
          email: order.customerEmail,
          address1: order.shippingAddress?.street || '',
          city: order.shippingAddress?.city || '',
          region: order.shippingAddress?.state || '',
          zip: order.shippingAddress?.postalCode || '',
          country: order.shippingAddress?.country || 'US'
        },
        status: 'ready',
        totalCost: conversion.netFiatAmount,
        paymentMethod: 'stripe'
      });

      await printifyOrder.updateStatus('ready', 'Ready for Printify order placement');

      logger.info(`Printify order created for conversion ${conversion._id}`);

      return printifyOrder;
    } catch (error) {
      logger.error('Failed to create Printify order:', error);
      throw error;
    }
  }

  /**
   * Approve a conversion
   */
  async approveConversion(conversionId, approvedBy, comment = '') {
    try {
      const conversion = await ConversionTransaction.findById(conversionId);
      if (!conversion) {
        throw new Error('Conversion not found');
      }

      if (conversion.status !== 'pending') {
        throw new Error('Only pending conversions can be approved');
      }

      if (!conversion.requiresApproval) {
        throw new Error('This conversion does not require approval');
      }

      // Update approval details
      conversion.approvedBy = approvedBy;
      conversion.approvedAt = new Date();
      await conversion.save();

      await conversion.updateStatus('pending', `Approved by admin: ${comment}`);

      logger.info(`Conversion ${conversionId} approved by ${approvedBy}`);

      // Add to processing queue
      this.addToQueue(conversionId);

      return conversion;
    } catch (error) {
      logger.error('Failed to approve conversion:', error);
      throw error;
    }
  }

  /**
   * Reject a conversion
   */
  async rejectConversion(conversionId, rejectedBy, reason) {
    try {
      const conversion = await ConversionTransaction.findById(conversionId);
      if (!conversion) {
        throw new Error('Conversion not found');
      }

      await conversion.updateStatus('cancelled', `Rejected by admin: ${reason}`);

      logger.info(`Conversion ${conversionId} rejected by ${rejectedBy}: ${reason}`);

      return conversion;
    } catch (error) {
      logger.error('Failed to reject conversion:', error);
      throw error;
    }
  }

  /**
   * Add conversion to processing queue
   */
  addToQueue(conversionId) {
    if (!this.processingQueue.includes(conversionId)) {
      this.processingQueue.push(conversionId);
      logger.debug(`Added conversion ${conversionId} to queue`);
    }
    
    // Start processing if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process conversion queue
   */
  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const conversionId = this.processingQueue.shift();
      
      try {
        logger.info(`Processing conversion ${conversionId} from queue`);
        await this.executeConversion(conversionId);
      } catch (error) {
        logger.error(`Failed to process conversion ${conversionId}:`, error.message);
      }

      // Small delay between conversions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isProcessing = false;
  }

  /**
   * Get conversion status
   */
  async getConversionStatus(conversionId) {
    try {
      const conversion = await ConversionTransaction.findById(conversionId)
        .populate('order')
        .populate('approvedBy', 'email name');

      if (!conversion) {
        throw new Error('Conversion not found');
      }

      return {
        id: conversion._id,
        orderId: conversion.order._id,
        status: conversion.status,
        cryptoAmount: conversion.cryptoAmount,
        cryptocurrency: conversion.cryptocurrency,
        fiatAmount: conversion.fiatAmount,
        fiatCurrency: conversion.fiatCurrency,
        exchangeRate: conversion.exchangeRate,
        exchange: conversion.exchange,
        fees: conversion.fees,
        totalFees: conversion.totalFees,
        netFiatAmount: conversion.netFiatAmount,
        riskLevel: conversion.riskLevel,
        requiresApproval: conversion.requiresApproval,
        approvedBy: conversion.approvedBy,
        approvedAt: conversion.approvedAt,
        completedAt: conversion.completedAt,
        statusHistory: conversion.statusHistory,
        lastError: conversion.lastError,
        createdAt: conversion.createdAt
      };
    } catch (error) {
      logger.error('Failed to get conversion status:', error);
      throw error;
    }
  }

  /**
   * Get conversion history
   */
  async getConversionHistory(filters = {}, options = {}) {
    try {
      const query = {};

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.exchange) {
        query.exchange = filters.exchange;
      }

      if (filters.cryptocurrency) {
        query.cryptocurrency = filters.cryptocurrency;
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const [conversions, total] = await Promise.all([
        ConversionTransaction.find(query)
          .populate('order', 'customerEmail totalPrice')
          .populate('approvedBy', 'email name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        ConversionTransaction.countDocuments(query)
      ]);

      return {
        conversions,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      };
    } catch (error) {
      logger.error('Failed to get conversion history:', error);
      throw error;
    }
  }

  /**
   * Get conversion statistics
   */
  async getConversionStats(startDate, endDate) {
    try {
      const stats = await ConversionTransaction.aggregate([
        {
          $match: {
            createdAt: { 
              $gte: new Date(startDate), 
              $lte: new Date(endDate) 
            }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalCryptoAmount: { $sum: '$cryptoAmount' },
            totalFiatAmount: { $sum: '$fiatAmount' },
            totalFees: { 
              $sum: { 
                $add: ['$fees.exchangeFee', '$fees.networkFee', '$fees.processingFee'] 
              }
            },
            avgExecutionTime: { $avg: '$metadata.executionTime' }
          }
        }
      ]);

      // Get exchange breakdown
      const exchangeStats = await ConversionTransaction.getStatsByExchange(
        new Date(startDate),
        new Date(endDate)
      );

      return {
        overview: stats,
        byExchange: exchangeStats,
        period: {
          start: startDate,
          end: endDate
        }
      };
    } catch (error) {
      logger.error('Failed to get conversion stats:', error);
      throw error;
    }
  }

  /**
   * Get pending conversions requiring approval
   */
  async getPendingApprovals() {
    try {
      return await ConversionTransaction.find({
        status: 'pending',
        requiresApproval: true,
        approvedBy: null
      })
        .populate('order', 'customerEmail totalPrice')
        .sort({ createdAt: 1 });
    } catch (error) {
      logger.error('Failed to get pending approvals:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ConversionService();
