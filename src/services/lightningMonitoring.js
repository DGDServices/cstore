const logger = require('../utils/logger');
const LightningInvoice = require('../models/LightningInvoice');
const LightningChannel = require('../models/LightningChannel');
const Payment = require('../models/Payment');

/**
 * Lightning Network Monitoring and Analytics Service
 * Tracks Lightning Network payment metrics, channel performance, and generates analytics
 */
class LightningMonitoringService {
  constructor() {
    this.metrics = {
      payments: {
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        totalVolume: 0, // in satoshis
        totalVolumeUSD: 0
      },
      channels: {
        total: 0,
        active: 0,
        inactive: 0,
        totalCapacity: 0,
        totalLocalBalance: 0,
        totalRemoteBalance: 0
      },
      fees: {
        totalPaid: 0,
        average: 0,
        count: 0
      },
      performance: {
        avgPaymentTime: 0,
        successRate: 0,
        invoiceExpiryRate: 0
      },
      recentActivity: []
    };
    
    this.startTime = Date.now();
  }

  /**
   * Record a payment event
   * @param {Object} paymentData - Payment data
   */
  recordPayment(paymentData) {
    const { status, amount, amountUSD, fee = 0 } = paymentData;
    
    this.metrics.payments.total++;
    
    if (status === 'paid' || status === 'confirmed') {
      this.metrics.payments.successful++;
      this.metrics.payments.totalVolume += amount;
      if (amountUSD) {
        this.metrics.payments.totalVolumeUSD += amountUSD;
      }
      
      // Record fee
      if (fee > 0) {
        this.metrics.fees.totalPaid += fee;
        this.metrics.fees.count++;
        this.metrics.fees.average = this.metrics.fees.totalPaid / this.metrics.fees.count;
      }
    } else if (status === 'failed' || status === 'cancelled') {
      this.metrics.payments.failed++;
    } else if (status === 'pending') {
      this.metrics.payments.pending++;
    }
    
    // Calculate success rate
    const completedPayments = this.metrics.payments.successful + this.metrics.payments.failed;
    if (completedPayments > 0) {
      this.metrics.performance.successRate = 
        (this.metrics.payments.successful / completedPayments) * 100;
    }
    
    // Record recent activity
    this.recordActivity({
      type: 'payment',
      status,
      amount,
      timestamp: Date.now()
    });
    
    logger.debug('Lightning payment recorded', {
      status,
      amount,
      successRate: this.metrics.performance.successRate.toFixed(2)
    });
  }

  /**
   * Record channel event
   * @param {Object} channelData - Channel data
   */
  recordChannel(channelData) {
    const { event, channelId, isActive } = channelData;
    
    // Record recent activity
    this.recordActivity({
      type: 'channel',
      event,
      channelId,
      timestamp: Date.now()
    });
    
    logger.debug('Lightning channel event recorded', {
      event,
      channelId,
      isActive
    });
  }

  /**
   * Record recent activity
   * @param {Object} activity - Activity data
   */
  recordActivity(activity) {
    this.metrics.recentActivity.push(activity);
    
    // Keep only last 100 activities
    if (this.metrics.recentActivity.length > 100) {
      this.metrics.recentActivity.shift();
    }
  }

  /**
   * Get payment statistics from database
   * @param {Date} startDate - Start date for statistics
   * @param {Date} endDate - End date for statistics
   * @returns {Promise<Object>}
   */
  async getPaymentStats(startDate = null, endDate = null) {
    try {
      const query = {};
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = startDate;
        if (endDate) query.createdAt.$lte = endDate;
      }
      
      const invoices = await LightningInvoice.find(query);
      
      const stats = {
        total: invoices.length,
        paid: invoices.filter(i => i.status === 'paid').length,
        expired: invoices.filter(i => i.status === 'expired').length,
        pending: invoices.filter(i => i.status === 'pending').length,
        cancelled: invoices.filter(i => i.status === 'cancelled').length,
        totalVolume: 0,
        totalVolumeUSD: 0,
        avgAmount: 0,
        avgAmountUSD: 0
      };
      
      // Calculate volumes
      const paidInvoices = invoices.filter(i => i.status === 'paid');
      if (paidInvoices.length > 0) {
        stats.totalVolume = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        stats.totalVolumeUSD = paidInvoices.reduce((sum, inv) => sum + (inv.amountUSD || 0), 0);
        stats.avgAmount = stats.totalVolume / paidInvoices.length;
        stats.avgAmountUSD = stats.totalVolumeUSD / paidInvoices.length;
      }
      
      // Calculate success rate
      const completedInvoices = stats.paid + stats.expired + stats.cancelled;
      stats.successRate = completedInvoices > 0 
        ? ((stats.paid / completedInvoices) * 100).toFixed(2) 
        : 0;
      
      // Calculate expiry rate
      stats.expiryRate = stats.total > 0 
        ? ((stats.expired / stats.total) * 100).toFixed(2) 
        : 0;
      
      return stats;
    } catch (error) {
      logger.error('Error getting payment stats:', error);
      throw error;
    }
  }

  /**
   * Get channel statistics from database
   * @returns {Promise<Object>}
   */
  async getChannelStats() {
    try {
      const channels = await LightningChannel.find();
      
      const stats = {
        total: channels.length,
        active: channels.filter(c => c.isActive).length,
        inactive: channels.filter(c => !c.isActive).length,
        pending: channels.filter(c => c.status === 'pending').length,
        closing: channels.filter(c => c.status === 'closing' || c.status === 'force-closing').length,
        closed: channels.filter(c => c.status === 'closed').length,
        totalCapacity: 0,
        totalLocalBalance: 0,
        totalRemoteBalance: 0,
        totalAvailableBalance: 0,
        avgCapacity: 0,
        channelUtilization: 0
      };
      
      if (channels.length > 0) {
        stats.totalCapacity = channels.reduce((sum, ch) => sum + (ch.capacity || 0), 0);
        stats.totalLocalBalance = channels.reduce((sum, ch) => sum + (ch.localBalance || 0), 0);
        stats.totalRemoteBalance = channels.reduce((sum, ch) => sum + (ch.remoteBalance || 0), 0);
        stats.totalAvailableBalance = channels.reduce((sum, ch) => sum + (ch.availableBalance || 0), 0);
        stats.avgCapacity = stats.totalCapacity / channels.length;
        
        // Calculate channel utilization (how much capacity is being used)
        if (stats.totalCapacity > 0) {
          const usedCapacity = stats.totalLocalBalance + stats.totalRemoteBalance;
          stats.channelUtilization = ((usedCapacity / stats.totalCapacity) * 100).toFixed(2);
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting channel stats:', error);
      throw error;
    }
  }

  /**
   * Get network fee analysis
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>}
   */
  async getFeeAnalysis(startDate = null, endDate = null) {
    try {
      const query = {
        cryptocurrency: 'BTC-LN',
        status: 'confirmed'
      };
      
      if (startDate || endDate) {
        query.confirmedAt = {};
        if (startDate) query.confirmedAt.$gte = startDate;
        if (endDate) query.confirmedAt.$lte = endDate;
      }
      
      const payments = await Payment.find(query);
      
      const analysis = {
        totalPayments: payments.length,
        totalFees: 0,
        avgFee: 0,
        minFee: Infinity,
        maxFee: 0,
        feeSavings: 0, // Compared to on-chain
        avgFeeSats: 0
      };
      
      // Note: Lightning fees are typically embedded in the payment
      // For now, we'll estimate very low fees (< 1 sat per payment on average)
      if (payments.length > 0) {
        // Estimate Lightning fees (typically < 1 sat)
        analysis.totalFees = payments.length * 0.5; // Average 0.5 sat per payment
        analysis.avgFee = analysis.totalFees / payments.length;
        analysis.avgFeeSats = 0.5;
        
        // Compare to typical on-chain fees (e.g., 1000 sats)
        const onChainFeeEstimate = 1000;
        analysis.feeSavings = (onChainFeeEstimate - analysis.avgFeeSats) * payments.length;
        analysis.savingsPercentage = (((onChainFeeEstimate - analysis.avgFeeSats) / onChainFeeEstimate) * 100).toFixed(2);
      }
      
      return analysis;
    } catch (error) {
      logger.error('Error getting fee analysis:', error);
      throw error;
    }
  }

  /**
   * Get transaction history with filters
   * @param {Object} filters - Filter options
   * @param {Object} options - Query options (limit, skip, sort)
   * @returns {Promise<Object>}
   */
  async getTransactionHistory(filters = {}, options = {}) {
    try {
      const { status, startDate, endDate } = filters;
      const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
      
      const query = {};
      
      if (status) {
        query.status = status;
      }
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = startDate;
        if (endDate) query.createdAt.$lte = endDate;
      }
      
      const [invoices, total] = await Promise.all([
        LightningInvoice.find(query)
          .sort(sort)
          .limit(limit)
          .skip(skip)
          .populate('order', 'status totalPriceUSD')
          .lean(),
        LightningInvoice.countDocuments(query)
      ]);
      
      return {
        invoices,
        total,
        limit,
        skip,
        hasMore: skip + invoices.length < total
      };
    } catch (error) {
      logger.error('Error getting transaction history:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard metrics
   * @returns {Promise<Object>}
   */
  async getDashboardMetrics() {
    try {
      const now = new Date();
      const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
      const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);
      
      const [
        paymentStats24h,
        paymentStats7d,
        paymentStats30d,
        channelStats,
        feeAnalysis30d,
        recentTransactions
      ] = await Promise.all([
        this.getPaymentStats(last24Hours, now),
        this.getPaymentStats(last7Days, now),
        this.getPaymentStats(last30Days, now),
        this.getChannelStats(),
        this.getFeeAnalysis(last30Days, now),
        this.getTransactionHistory({}, { limit: 10 })
      ]);
      
      return {
        timestamp: now.toISOString(),
        payments: {
          last24Hours: paymentStats24h,
          last7Days: paymentStats7d,
          last30Days: paymentStats30d
        },
        channels: channelStats,
        fees: feeAnalysis30d,
        recentTransactions: recentTransactions.invoices,
        uptime: Math.floor((Date.now() - this.startTime) / 1000)
      };
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get channel performance metrics
   * @returns {Promise<Object>}
   */
  async getChannelPerformance() {
    try {
      const channels = await LightningChannel.find({ isActive: true });
      
      const performance = channels.map(channel => {
        const utilizationRate = channel.capacity > 0
          ? ((channel.localBalance / channel.capacity) * 100).toFixed(2)
          : 0;
        
        const balanceRatio = (channel.localBalance + channel.remoteBalance) > 0
          ? ((channel.localBalance / (channel.localBalance + channel.remoteBalance)) * 100).toFixed(2)
          : 50;
        
        return {
          channelId: channel.channelId,
          remotePubkey: channel.remotePubkey,
          capacity: channel.capacity,
          localBalance: channel.localBalance,
          remoteBalance: channel.remoteBalance,
          availableBalance: channel.availableBalance,
          utilizationRate,
          balanceRatio,
          totalSent: channel.totalSatoshisSent || 0,
          totalReceived: channel.totalSatoshisReceived || 0,
          isBalanced: Math.abs(parseFloat(balanceRatio) - 50) < 20, // Within 30-70% range
          needsRebalancing: Math.abs(parseFloat(balanceRatio) - 50) > 30
        };
      });
      
      // Sort by channels that need rebalancing
      performance.sort((a, b) => {
        if (a.needsRebalancing && !b.needsRebalancing) return -1;
        if (!a.needsRebalancing && b.needsRebalancing) return 1;
        return Math.abs(b.balanceRatio - 50) - Math.abs(a.balanceRatio - 50);
      });
      
      return {
        channels: performance,
        summary: {
          total: channels.length,
          needsRebalancing: performance.filter(c => c.needsRebalancing).length,
          balanced: performance.filter(c => c.isBalanced).length,
          avgUtilization: performance.length > 0
            ? (performance.reduce((sum, c) => sum + parseFloat(c.utilizationRate), 0) / performance.length).toFixed(2)
            : 0
        }
      };
    } catch (error) {
      logger.error('Error getting channel performance:', error);
      throw error;
    }
  }

  /**
   * Generate analytics report
   * @param {Object} options - Report options
   * @returns {Promise<Object>}
   */
  async generateReport(options = {}) {
    try {
      const { period = '30d' } = options;
      
      let startDate;
      const endDate = new Date();
      
      switch (period) {
        case '24h':
          startDate = new Date(endDate - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(endDate - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(endDate - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(endDate - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(endDate - 30 * 24 * 60 * 60 * 1000);
      }
      
      const [paymentStats, channelStats, feeAnalysis, channelPerformance] = await Promise.all([
        this.getPaymentStats(startDate, endDate),
        this.getChannelStats(),
        this.getFeeAnalysis(startDate, endDate),
        this.getChannelPerformance()
      ]);
      
      return {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        payments: paymentStats,
        channels: channelStats,
        fees: feeAnalysis,
        performance: channelPerformance,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Reset in-memory metrics
   */
  reset() {
    this.metrics = {
      payments: {
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        totalVolume: 0,
        totalVolumeUSD: 0
      },
      channels: {
        total: 0,
        active: 0,
        inactive: 0,
        totalCapacity: 0,
        totalLocalBalance: 0,
        totalRemoteBalance: 0
      },
      fees: {
        totalPaid: 0,
        average: 0,
        count: 0
      },
      performance: {
        avgPaymentTime: 0,
        successRate: 0,
        invoiceExpiryRate: 0
      },
      recentActivity: []
    };
    this.startTime = Date.now();
  }
}

module.exports = new LightningMonitoringService();
