const AMLAlert = require('../models/AMLAlert');
const ConversionTransaction = require('../models/ConversionTransaction');
const logger = require('../utils/logger');

/**
 * AML Service
 * Anti-Money Laundering monitoring and compliance
 */
class AMLService {
  constructor() {
    this.enabled = process.env.AML_ENABLED === 'true';
    this.thresholds = {
      ctr: 10000, // Currency Transaction Report threshold (USD)
      high: parseInt(process.env.RISK_THRESHOLD_HIGH) || 85,
      medium: parseInt(process.env.RISK_THRESHOLD_MEDIUM) || 50,
      autoBlock: parseInt(process.env.AUTO_BLOCK_THRESHOLD) || 95,
      manualReview: parseInt(process.env.MANUAL_REVIEW_THRESHOLD) || 75
    };
  }

  /**
   * Monitor a transaction for AML compliance
   */
  async monitorTransaction(transaction) {
    if (!this.enabled) {
      return { allowed: true, alerts: [] };
    }

    try {
      const alerts = [];
      const userId = transaction.user || transaction.userId;

      // Check amount thresholds
      if (transaction.fiatAmount >= this.thresholds.ctr) {
        const alert = await this.createAlert({
          user: userId,
          transaction: transaction._id,
          type: 'CTR_REQUIRED',
          severity: 'high',
          description: `Transaction amount $${transaction.fiatAmount} exceeds CTR threshold`,
          details: {
            amount: transaction.fiatAmount,
            threshold: this.thresholds.ctr
          }
        });
        alerts.push(alert);
      }

      // Check for large transactions
      if (transaction.fiatAmount >= 5000) {
        const alert = await this.createAlert({
          user: userId,
          transaction: transaction._id,
          type: 'LARGE_TRANSACTION',
          severity: 'medium',
          description: `Large transaction detected: $${transaction.fiatAmount}`,
          details: {
            amount: transaction.fiatAmount
          }
        });
        alerts.push(alert);
      }

      // Check for structuring
      const structuringDetected = await this.detectStructuring(userId, transaction);
      if (structuringDetected) {
        const alert = await this.createAlert({
          user: userId,
          transaction: transaction._id,
          type: 'POTENTIAL_STRUCTURING',
          severity: 'critical',
          description: 'Multiple transactions below reporting threshold detected',
          details: structuringDetected
        });
        alerts.push(alert);
      }

      // Check for rapid succession
      const rapidSuccession = await this.detectRapidSuccession(userId);
      if (rapidSuccession) {
        const alert = await this.createAlert({
          user: userId,
          transaction: transaction._id,
          type: 'RAPID_SUCCESSION',
          severity: 'medium',
          description: 'Multiple transactions in short time period',
          details: rapidSuccession
        });
        alerts.push(alert);
      }

      // Check for unusual patterns
      const unusualPattern = await this.detectUnusualPattern(userId, transaction);
      if (unusualPattern) {
        const alert = await this.createAlert({
          user: userId,
          transaction: transaction._id,
          type: 'UNUSUAL_PATTERN',
          severity: 'medium',
          description: 'Transaction pattern differs from user history',
          details: unusualPattern
        });
        alerts.push(alert);
      }

      logger.info(`AML monitoring completed for transaction ${transaction._id}: ${alerts.length} alerts`);

      // Determine if transaction should be blocked
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      const allowed = criticalAlerts.length === 0;

      return {
        allowed,
        alerts,
        requiresReview: alerts.some(a => a.severity === 'high' || a.severity === 'critical')
      };
    } catch (error) {
      logger.error(`Error monitoring transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create an AML alert
   */
  async createAlert(alertData) {
    try {
      const alert = new AMLAlert(alertData);
      await alert.save();
      
      logger.info(`AML alert created: ${alert.type} for user ${alert.user}`);
      
      // Send notification to compliance team
      if (alert.severity === 'critical' || alert.severity === 'high') {
        await this.notifyComplianceTeam(alert);
      }

      return alert;
    } catch (error) {
      logger.error(`Error creating AML alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect structuring (smurfing) - multiple transactions below threshold
   */
  async detectStructuring(userId, currentTransaction) {
    try {
      const timeWindow = 24; // hours
      const startDate = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

      const recentTransactions = await ConversionTransaction.find({
        user: userId,
        createdAt: { $gte: startDate },
        status: { $in: ['completed', 'pending'] }
      });

      // Look for multiple transactions just below CTR threshold
      const justBelowThreshold = recentTransactions.filter(
        tx => tx.fiatAmount >= 9000 && tx.fiatAmount < this.thresholds.ctr
      );

      if (justBelowThreshold.length >= 3) {
        const totalAmount = justBelowThreshold.reduce((sum, tx) => sum + tx.fiatAmount, 0);
        return {
          count: justBelowThreshold.length,
          totalAmount,
          timeWindow: `${timeWindow} hours`,
          transactions: justBelowThreshold.map(tx => tx._id)
        };
      }

      return null;
    } catch (error) {
      logger.error(`Error detecting structuring: ${error.message}`);
      return null;
    }
  }

  /**
   * Detect rapid succession of transactions
   */
  async detectRapidSuccession(userId) {
    try {
      const timeWindow = 1; // hour
      const startDate = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

      const recentTransactions = await ConversionTransaction.find({
        user: userId,
        createdAt: { $gte: startDate },
        status: { $in: ['completed', 'pending'] }
      });

      if (recentTransactions.length >= 5) {
        return {
          count: recentTransactions.length,
          timeWindow: `${timeWindow} hour`,
          transactions: recentTransactions.map(tx => tx._id)
        };
      }

      return null;
    } catch (error) {
      logger.error(`Error detecting rapid succession: ${error.message}`);
      return null;
    }
  }

  /**
   * Detect unusual transaction patterns
   */
  async detectUnusualPattern(userId, currentTransaction) {
    try {
      // Get user's historical average
      const historicalTransactions = await ConversionTransaction.find({
        user: userId,
        status: 'completed',
        createdAt: { $lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      if (historicalTransactions.length < 5) {
        return null; // Not enough history
      }

      const avgAmount = historicalTransactions.reduce((sum, tx) => sum + tx.fiatAmount, 0) / historicalTransactions.length;

      // Alert if current transaction is 5x the average
      if (currentTransaction.fiatAmount > avgAmount * 5) {
        return {
          currentAmount: currentTransaction.fiatAmount,
          historicalAverage: avgAmount,
          multiplier: (currentTransaction.fiatAmount / avgAmount).toFixed(2)
        };
      }

      return null;
    } catch (error) {
      logger.error(`Error detecting unusual pattern: ${error.message}`);
      return null;
    }
  }

  /**
   * Notify compliance team of alerts
   */
  async notifyComplianceTeam(alert) {
    try {
      // In production, this would send email/SMS to compliance officer
      logger.info(`[COMPLIANCE ALERT] ${alert.type} - Severity: ${alert.severity}`);
      
      // Could integrate with email service, Slack, etc.
      const complianceEmail = process.env.COMPLIANCE_OFFICER_EMAIL;
      if (complianceEmail) {
        logger.info(`Notification should be sent to: ${complianceEmail}`);
      }
    } catch (error) {
      logger.error(`Error notifying compliance team: ${error.message}`);
    }
  }

  /**
   * Generate Suspicious Activity Report (SAR)
   */
  async generateSAR(alertId, reportData) {
    try {
      const alert = await AMLAlert.findById(alertId)
        .populate('user')
        .populate('transaction');

      if (!alert) {
        throw new Error('Alert not found');
      }

      // Create SAR report
      const sarReport = {
        reportId: `SAR-${Date.now()}`,
        alertId: alert._id,
        userId: alert.user._id,
        transactionId: alert.transaction?._id,
        type: alert.type,
        description: reportData.description,
        findings: reportData.findings,
        recommendation: reportData.recommendation,
        generatedAt: new Date(),
        generatedBy: reportData.generatedBy
      };

      // Update alert status
      alert.status = 'filed';
      alert.filingReference = sarReport.reportId;
      alert.filedAt = new Date();
      await alert.save();

      logger.info(`SAR generated: ${sarReport.reportId}`);

      return sarReport;
    } catch (error) {
      logger.error(`Error generating SAR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get alerts for a user
   */
  async getUserAlerts(userId, filters = {}) {
    try {
      const query = { user: userId };
      
      if (filters.type) {
        query.type = filters.type;
      }
      
      if (filters.severity) {
        query.severity = filters.severity;
      }
      
      if (filters.status) {
        query.status = filters.status;
      }

      const alerts = await AMLAlert.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50);

      return alerts;
    } catch (error) {
      logger.error(`Error getting user alerts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, resolution) {
    try {
      const alert = await AMLAlert.findById(alertId);
      
      if (!alert) {
        throw new Error('Alert not found');
      }

      alert.status = 'resolved';
      alert.resolution = {
        action: resolution.action,
        notes: resolution.notes,
        resolvedBy: resolution.resolvedBy,
        resolvedAt: new Date()
      };

      await alert.save();

      logger.info(`Alert ${alertId} resolved`);

      return alert;
    } catch (error) {
      logger.error(`Error resolving alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get AML statistics
   */
  async getStatistics(startDate, endDate) {
    try {
      const stats = await AMLAlert.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              $lte: endDate || new Date()
            }
          }
        },
        {
          $group: {
            _id: {
              type: '$type',
              severity: '$severity'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      return stats;
    } catch (error) {
      logger.error(`Error getting AML statistics: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AMLService();
