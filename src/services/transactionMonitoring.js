const amlService = require('./aml');
const sanctionsService = require('./sanctions');
const logger = require('../utils/logger');

/**
 * Transaction Monitoring Service
 * Real-time monitoring of transactions for AML/compliance
 */
class TransactionMonitoringService {
  constructor() {
    this.enabled = process.env.AML_ENABLED === 'true';
    this.autoBlockThreshold = parseInt(process.env.AUTO_BLOCK_THRESHOLD) || 95;
    this.manualReviewThreshold = parseInt(process.env.MANUAL_REVIEW_THRESHOLD) || 75;
  }

  /**
   * Monitor transaction before execution
   */
  async monitorBeforeTransaction(transaction, user) {
    if (!this.enabled) {
      return {
        approved: true,
        riskScore: 0,
        checks: []
      };
    }

    try {
      logger.info(`Monitoring transaction for user ${user._id}`);

      const checks = [];
      let totalRiskScore = 0;

      // 1. Sanctions screening
      const sanctionsResult = await sanctionsService.screenUser(user._id, {
        name: user.name,
        country: user.country
      });

      checks.push({
        type: 'sanctions',
        passed: sanctionsResult.action !== 'block',
        result: sanctionsResult
      });

      if (sanctionsResult.action === 'block') {
        totalRiskScore += 100;
      } else if (sanctionsResult.action === 'manual_review') {
        totalRiskScore += 50;
      }

      // 2. AML monitoring
      const amlResult = await amlService.monitorTransaction(transaction);
      
      checks.push({
        type: 'aml',
        passed: amlResult.allowed,
        result: amlResult
      });

      if (!amlResult.allowed) {
        totalRiskScore += 80;
      } else if (amlResult.requiresReview) {
        totalRiskScore += 40;
      }

      // 3. Risk-based scoring
      const riskScore = this.calculateTransactionRisk(transaction, user);
      
      checks.push({
        type: 'risk_assessment',
        passed: riskScore < this.manualReviewThreshold,
        result: { score: riskScore }
      });

      totalRiskScore += riskScore;

      // Determine approval status
      const approved = totalRiskScore < this.autoBlockThreshold;
      const requiresManualReview = totalRiskScore >= this.manualReviewThreshold && totalRiskScore < this.autoBlockThreshold;

      logger.info(`Transaction monitoring complete: Risk Score ${totalRiskScore}, Approved: ${approved}`);

      return {
        approved,
        requiresManualReview,
        riskScore: totalRiskScore,
        checks,
        alerts: amlResult.alerts || []
      };
    } catch (error) {
      logger.error(`Error monitoring transaction: ${error.message}`);
      // In case of error, allow transaction but log it
      return {
        approved: true,
        riskScore: 0,
        checks: [],
        error: error.message
      };
    }
  }

  /**
   * Calculate risk score for a transaction
   */
  calculateTransactionRisk(transaction, user) {
    let riskScore = 0;

    // Amount-based risk
    if (transaction.fiatAmount > 10000) {
      riskScore += 30;
    } else if (transaction.fiatAmount > 5000) {
      riskScore += 20;
    } else if (transaction.fiatAmount > 1000) {
      riskScore += 10;
    }

    // High-risk countries
    const highRiskCountries = ['IR', 'KP', 'SY', 'CU'];
    if (user.country && highRiskCountries.includes(user.country)) {
      riskScore += 40;
    }

    // New user risk
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const daysSinceCreation = accountAge / (24 * 60 * 60 * 1000);
    
    if (daysSinceCreation < 7) {
      riskScore += 25;
    } else if (daysSinceCreation < 30) {
      riskScore += 15;
    }

    return Math.min(riskScore, 100);
  }

  /**
   * Post-transaction monitoring
   */
  async monitorAfterTransaction(transaction) {
    try {
      // Log transaction for pattern analysis
      logger.info(`Post-transaction monitoring for ${transaction._id}`);

      // Check for patterns that might indicate issues
      // This could trigger alerts for compliance review
      
      return {
        success: true
      };
    } catch (error) {
      logger.error(`Error in post-transaction monitoring: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate monitoring report
   */
  async generateMonitoringReport(startDate, endDate) {
    try {
      const amlStats = await amlService.getStatistics(startDate, endDate);
      const sanctionsStats = await sanctionsService.getStatistics(startDate, endDate);

      return {
        period: {
          start: startDate,
          end: endDate
        },
        aml: amlStats,
        sanctions: sanctionsStats,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error generating monitoring report: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new TransactionMonitoringService();
