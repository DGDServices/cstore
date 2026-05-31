const RiskCalculator = require('../utils/riskCalculator');
const ConversionTransaction = require('../models/ConversionTransaction');
const logger = require('../utils/logger');
const conversionConfig = require('../../config/conversion');

/**
 * Risk Service
 * Manages risk assessment and monitoring for conversions
 */
class RiskService {
  constructor() {
    this.alertHistory = [];
    this.monitoringEnabled = true;
  }

  /**
   * Assess risk for a conversion
   */
  async assessConversionRisk(conversionData) {
    try {
      // Calculate risk score
      const riskAnalysis = await RiskCalculator.calculateRiskScore(conversionData);
      const riskLevel = RiskCalculator.determineRiskLevel(riskAnalysis.totalScore);

      // Validate conversion
      const validation = await RiskCalculator.validateConversion({
        ...conversionData,
        volatility: conversionData.volatility || 0,
        slippage: conversionData.slippage || 0,
        totalFeePercentage: conversionData.totalFeePercentage || 0
      });

      // Generate risk report
      const report = await RiskCalculator.generateRiskReport(conversionData);

      // Check if requires approval
      const approvalCheck = RiskCalculator.requiresApproval(
        conversionData.fiatAmount,
        riskLevel
      );

      return {
        riskScore: riskAnalysis.totalScore,
        riskLevel,
        riskBreakdown: riskAnalysis.breakdown,
        requiresApproval: approvalCheck.required,
        approvalReason: approvalCheck.reason,
        validation,
        report,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to assess conversion risk:', error);
      throw error;
    }
  }

  /**
   * Monitor conversion success rate
   */
  async monitorSuccessRate(timeWindow = 24) {
    try {
      const startDate = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
      
      const stats = await ConversionTransaction.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          successRate: 100,
          total: 0,
          successful: 0,
          failed: 0,
          alert: false
        };
      }

      const data = stats[0];
      const successRate = (data.successful / data.total) * 100;
      const threshold = conversionConfig.monitoring.successRateAlertThreshold;
      
      const result = {
        successRate: parseFloat(successRate.toFixed(2)),
        total: data.total,
        successful: data.successful,
        failed: data.failed,
        alert: successRate < threshold,
        threshold,
        timeWindow: `${timeWindow}h`
      };

      if (result.alert) {
        await this.createAlert('low_success_rate', result);
      }

      return result;
    } catch (error) {
      logger.error('Failed to monitor success rate:', error);
      throw error;
    }
  }

  /**
   * Monitor average conversion time
   */
  async monitorAverageTime(timeWindow = 24) {
    try {
      const startDate = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
      
      const stats = await ConversionTransaction.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: 'completed',
            'metadata.executionTime': { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$metadata.executionTime' },
            minTime: { $min: '$metadata.executionTime' },
            maxTime: { $max: '$metadata.executionTime' },
            count: { $sum: 1 }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          avgTime: 0,
          minTime: 0,
          maxTime: 0,
          count: 0,
          alert: false
        };
      }

      const data = stats[0];
      const threshold = conversionConfig.monitoring.avgTimeAlertThreshold;
      
      const result = {
        avgTime: Math.round(data.avgTime),
        minTime: Math.round(data.minTime),
        maxTime: Math.round(data.maxTime),
        count: data.count,
        alert: data.avgTime > threshold,
        threshold,
        timeWindow: `${timeWindow}h`
      };

      if (result.alert) {
        await this.createAlert('high_avg_time', result);
      }

      return result;
    } catch (error) {
      logger.error('Failed to monitor average time:', error);
      throw error;
    }
  }

  /**
   * Check for consecutive failures
   */
  async checkConsecutiveFailures(exchangeName = null) {
    try {
      const query = { status: 'failed' };
      if (exchangeName) {
        query.exchange = exchangeName;
      }

      const recentFailures = await ConversionTransaction.find(query)
        .sort({ createdAt: -1 })
        .limit(10);

      let consecutiveCount = 0;
      for (const failure of recentFailures) {
        if (failure.status === 'failed') {
          consecutiveCount++;
        } else {
          break;
        }
      }

      const threshold = conversionConfig.monitoring.consecutiveFailureAlert;
      const alert = consecutiveCount >= threshold;

      if (alert) {
        await this.createAlert('consecutive_failures', {
          count: consecutiveCount,
          exchange: exchangeName,
          threshold
        });
      }

      return {
        consecutiveFailures: consecutiveCount,
        alert,
        threshold,
        exchange: exchangeName
      };
    } catch (error) {
      logger.error('Failed to check consecutive failures:', error);
      throw error;
    }
  }

  /**
   * Monitor exchange reliability
   */
  async monitorExchangeReliability() {
    try {
      const timeWindow = 24; // hours
      const startDate = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

      const stats = await ConversionTransaction.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$exchange',
            total: { $sum: 1 },
            successful: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            avgExecutionTime: { $avg: '$metadata.executionTime' }
          }
        }
      ]);

      const reliability = stats.map(stat => {
        const successRate = (stat.successful / stat.total) * 100;
        
        return {
          exchange: stat._id,
          total: stat.total,
          successful: stat.successful,
          failed: stat.failed,
          successRate: parseFloat(successRate.toFixed(2)),
          avgExecutionTime: Math.round(stat.avgExecutionTime || 0),
          reliable: successRate >= 95,
          timeWindow: `${timeWindow}h`
        };
      });

      return reliability;
    } catch (error) {
      logger.error('Failed to monitor exchange reliability:', error);
      throw error;
    }
  }

  /**
   * Check daily limits
   */
  async checkDailyLimits(userId = null) {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Total daily conversions
      const totalQuery = {
        createdAt: { $gte: startOfDay },
        status: { $in: ['completed', 'converting', 'pending'] }
      };

      const totalAmount = await ConversionTransaction.aggregate([
        { $match: totalQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$fiatAmount' }
          }
        }
      ]);

      const dailyTotal = totalAmount.length > 0 ? totalAmount[0].total : 0;
      const dailyLimit = conversionConfig.limits.dailyTotalLimit;

      const result = {
        dailyTotal: parseFloat(dailyTotal.toFixed(2)),
        dailyLimit,
        remainingLimit: parseFloat((dailyLimit - dailyTotal).toFixed(2)),
        withinLimit: dailyTotal < dailyLimit
      };

      // User-specific limits if userId provided
      if (userId) {
        const userQuery = {
          ...totalQuery,
          initiatedBy: userId
        };

        const userAmount = await ConversionTransaction.aggregate([
          { $match: userQuery },
          {
            $group: {
              _id: null,
              total: { $sum: '$fiatAmount' }
            }
          }
        ]);

        const userTotal = userAmount.length > 0 ? userAmount[0].total : 0;
        const userLimit = conversionConfig.limits.dailyUserLimit;

        result.userTotal = parseFloat(userTotal.toFixed(2));
        result.userLimit = userLimit;
        result.userRemainingLimit = parseFloat((userLimit - userTotal).toFixed(2));
        result.userWithinLimit = userTotal < userLimit;
      }

      return result;
    } catch (error) {
      logger.error('Failed to check daily limits:', error);
      throw error;
    }
  }

  /**
   * Get high-risk conversions
   */
  async getHighRiskConversions(limit = 50) {
    try {
      return await ConversionTransaction.find({
        riskLevel: 'high',
        status: { $in: ['pending', 'converting'] }
      })
        .populate('order', 'customerEmail totalPrice')
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get high-risk conversions:', error);
      throw error;
    }
  }

  /**
   * Create alert
   */
  async createAlert(type, data) {
    const alert = {
      type,
      data,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alertHistory.push(alert);

    // Keep only last 100 alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }

    logger.warn(`Risk alert created: ${type}`, data);

    // Here you would typically send notifications
    // via email, Slack, etc.

    return alert;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 20) {
    return this.alertHistory
      .slice(-limit)
      .reverse();
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(timestamp) {
    const alert = this.alertHistory.find(a => 
      a.timestamp.getTime() === new Date(timestamp).getTime()
    );
    
    if (alert) {
      alert.acknowledged = true;
      logger.info(`Alert acknowledged: ${alert.type}`);
    }
  }

  /**
   * Get risk dashboard data
   */
  async getRiskDashboard() {
    try {
      const [
        successRate,
        avgTime,
        exchangeReliability,
        dailyLimits,
        highRiskConversions,
        recentAlerts
      ] = await Promise.all([
        this.monitorSuccessRate(),
        this.monitorAverageTime(),
        this.monitorExchangeReliability(),
        this.checkDailyLimits(),
        this.getHighRiskConversions(10),
        Promise.resolve(this.getRecentAlerts(10))
      ]);

      return {
        successRate,
        avgTime,
        exchangeReliability,
        dailyLimits,
        highRiskConversions: highRiskConversions.length,
        recentAlerts,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get risk dashboard:', error);
      throw error;
    }
  }

  /**
   * Enable/disable monitoring
   */
  setMonitoring(enabled) {
    this.monitoringEnabled = enabled;
    logger.info(`Risk monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Export singleton instance
module.exports = new RiskService();
