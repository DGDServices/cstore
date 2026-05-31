const AMLAlert = require('../models/AMLAlert');
const ConversionTransaction = require('../models/ConversionTransaction');
const logger = require('../utils/logger');

/**
 * Compliance Reporting Service
 * Handles regulatory reporting (FinCEN, state regulators, tax authorities)
 */
class ComplianceReportingService {
  constructor() {
    this.fincenEnabled = process.env.FINCEN_ENABLED === 'true';
    this.stateReportingEnabled = process.env.STATE_REPORTING_ENABLED === 'true';
    this.taxReportingEnabled = process.env.TAX_REPORTING_ENABLED === 'true';
  }

  /**
   * Generate Currency Transaction Report (CTR) for transactions over $10,000
   */
  async generateCTR(transactionId) {
    try {
      const transaction = await ConversionTransaction.findById(transactionId)
        .populate('user');

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.fiatAmount < 10000) {
        throw new Error('CTR only required for transactions over $10,000');
      }

      const ctr = {
        reportType: 'CTR',
        reportId: `CTR-${Date.now()}`,
        transactionDate: transaction.createdAt,
        amount: transaction.fiatAmount,
        currency: transaction.fiatCurrency,
        customerInfo: {
          name: transaction.user.name,
          email: transaction.user.email,
          country: transaction.user.country
        },
        transactionDetails: {
          type: 'cryptocurrency_conversion',
          fromCurrency: transaction.cryptocurrency,
          fromAmount: transaction.cryptoAmount,
          toCurrency: transaction.fiatCurrency,
          toAmount: transaction.fiatAmount
        },
        generatedAt: new Date()
      };

      logger.info(`CTR generated: ${ctr.reportId}`);

      return ctr;
    } catch (error) {
      logger.error(`Error generating CTR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate Suspicious Activity Report (SAR)
   */
  async generateSAR(alertId, investigationDetails) {
    try {
      const alert = await AMLAlert.findById(alertId)
        .populate('user')
        .populate('transaction');

      if (!alert) {
        throw new Error('Alert not found');
      }

      const sar = {
        reportType: 'SAR',
        reportId: `SAR-${Date.now()}`,
        filingDate: new Date(),
        suspiciousActivity: {
          type: alert.type,
          description: alert.description,
          dateDetected: alert.createdAt
        },
        subjectInfo: {
          name: alert.user.name,
          email: alert.user.email,
          country: alert.user.country
        },
        transactionInfo: alert.transaction ? {
          id: alert.transaction._id,
          date: alert.transaction.createdAt,
          amount: alert.transaction.fiatAmount,
          currency: alert.transaction.fiatCurrency
        } : null,
        investigation: investigationDetails,
        generatedAt: new Date()
      };

      // Update alert status
      alert.status = 'filed';
      alert.filingReference = sar.reportId;
      alert.filedAt = new Date();
      await alert.save();

      logger.info(`SAR generated: ${sar.reportId}`);

      return sar;
    } catch (error) {
      logger.error(`Error generating SAR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate daily transaction summary report
   */
  async generateDailySummaryReport(date = new Date()) {
    try {
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const summary = await ConversionTransaction.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startOfDay,
              $lte: endOfDay
            },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$fiatCurrency',
            totalVolume: { $sum: '$fiatAmount' },
            transactionCount: { $sum: 1 },
            avgTransactionSize: { $avg: '$fiatAmount' }
          }
        }
      ]);

      const report = {
        reportType: 'DAILY_SUMMARY',
        date: startOfDay,
        summary,
        generatedAt: new Date()
      };

      logger.info(`Daily summary report generated for ${startOfDay.toDateString()}`);

      return report;
    } catch (error) {
      logger.error(`Error generating daily summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate monthly regulatory report
   */
  async generateMonthlyReport(year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      // Transaction statistics
      const transactionStats = await ConversionTransaction.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalVolume: { $sum: '$fiatAmount' }
          }
        }
      ]);

      // AML alerts
      const amlAlerts = await AMLAlert.countDocuments({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      });

      // CTRs filed
      const ctrs = await AMLAlert.countDocuments({
        type: 'CTR_REQUIRED',
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      });

      // SARs filed
      const sars = await AMLAlert.countDocuments({
        type: 'SAR_REQUIRED',
        status: 'filed',
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      });

      const report = {
        reportType: 'MONTHLY_REGULATORY',
        period: {
          year,
          month,
          startDate,
          endDate
        },
        statistics: {
          transactions: transactionStats,
          amlAlerts,
          ctrs,
          sars
        },
        generatedAt: new Date()
      };

      logger.info(`Monthly regulatory report generated for ${year}-${month}`);

      return report;
    } catch (error) {
      logger.error(`Error generating monthly report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate tax report (Form 1099 equivalent)
   */
  async generateTaxReport(userId, taxYear) {
    try {
      if (!this.taxReportingEnabled) {
        throw new Error('Tax reporting not enabled');
      }

      const startDate = new Date(taxYear, 0, 1);
      const endDate = new Date(taxYear, 11, 31, 23, 59, 59, 999);

      const transactions = await ConversionTransaction.find({
        user: userId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        status: 'completed'
      });

      const totalVolume = transactions.reduce((sum, tx) => sum + tx.fiatAmount, 0);
      const totalTransactions = transactions.length;

      const taxReport = {
        reportType: 'TAX_REPORT',
        taxYear,
        userId,
        totalVolume,
        totalTransactions,
        transactions: transactions.map(tx => ({
          date: tx.createdAt,
          type: 'conversion',
          amount: tx.fiatAmount,
          currency: tx.fiatCurrency,
          cryptocurrency: tx.cryptocurrency,
          cryptoAmount: tx.cryptoAmount
        })),
        generatedAt: new Date()
      };

      logger.info(`Tax report generated for user ${userId}, year ${taxYear}`);

      return taxReport;
    } catch (error) {
      logger.error(`Error generating tax report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Submit report to FinCEN (simulated)
   */
  async submitToFinCEN(report) {
    try {
      if (!this.fincenEnabled) {
        throw new Error('FinCEN submission not enabled');
      }

      // In production, this would integrate with FinCEN BSA E-Filing System
      logger.info(`Submitting ${report.reportType} to FinCEN: ${report.reportId}`);

      // Simulated submission
      const submission = {
        reportId: report.reportId,
        reportType: report.reportType,
        submittedAt: new Date(),
        status: 'submitted',
        confirmationNumber: `FINCEN-${Date.now()}`
      };

      logger.info(`Report submitted to FinCEN: ${submission.confirmationNumber}`);

      return submission;
    } catch (error) {
      logger.error(`Error submitting to FinCEN: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get reporting statistics
   */
  async getReportingStatistics(startDate, endDate) {
    try {
      const stats = {
        period: {
          start: startDate,
          end: endDate
        },
        ctrs: await AMLAlert.countDocuments({
          type: 'CTR_REQUIRED',
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        sars: await AMLAlert.countDocuments({
          type: 'SAR_REQUIRED',
          status: 'filed',
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        totalAlerts: await AMLAlert.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        generatedAt: new Date()
      };

      return stats;
    } catch (error) {
      logger.error(`Error getting reporting statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate compliance dashboard data
   */
  async generateDashboardData() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const data = {
        pendingAlerts: await AMLAlert.countDocuments({
          status: { $in: ['open', 'under_review'] }
        }),
        recentCTRs: await AMLAlert.countDocuments({
          type: 'CTR_REQUIRED',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        recentSARs: await AMLAlert.countDocuments({
          type: 'SAR_REQUIRED',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        highRiskTransactions: await ConversionTransaction.countDocuments({
          fiatAmount: { $gte: 5000 },
          createdAt: { $gte: thirtyDaysAgo }
        }),
        generatedAt: new Date()
      };

      return data;
    } catch (error) {
      logger.error(`Error generating dashboard data: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ComplianceReportingService();
