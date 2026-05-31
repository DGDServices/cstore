const DataRetentionPolicy = require('../models/DataRetentionPolicy');
const logger = require('../utils/logger');

/**
 * Data Retention Service
 * Manages data retention policies and automated data purging
 */
class DataRetentionService {
  constructor() {
    this.defaultRetentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 2555; // 7 years
  }

  /**
   * Create or update retention policy
   */
  async setRetentionPolicy(dataType, retentionDays, options = {}) {
    try {
      let policy = await DataRetentionPolicy.findOne({ dataType });

      if (policy) {
        policy.retentionPeriodDays = retentionDays;
        policy.description = options.description || policy.description;
        policy.legalBasis = options.legalBasis || policy.legalBasis;
        policy.deleteAfterExpiry = options.deleteAfterExpiry !== undefined ? options.deleteAfterExpiry : policy.deleteAfterExpiry;
        policy.archiveBeforeDelete = options.archiveBeforeDelete !== undefined ? options.archiveBeforeDelete : policy.archiveBeforeDelete;
      } else {
        policy = new DataRetentionPolicy({
          dataType,
          retentionPeriodDays: retentionDays,
          description: options.description,
          legalBasis: options.legalBasis,
          deleteAfterExpiry: options.deleteAfterExpiry !== undefined ? options.deleteAfterExpiry : true,
          archiveBeforeDelete: options.archiveBeforeDelete || false
        });
      }

      await policy.save();

      logger.info(`Retention policy set for ${dataType}: ${retentionDays} days`);

      return policy;
    } catch (error) {
      logger.error(`Error setting retention policy: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get retention policy for data type
   */
  async getRetentionPolicy(dataType) {
    try {
      const policy = await DataRetentionPolicy.findOne({
        dataType,
        status: 'active'
      });

      return policy;
    } catch (error) {
      logger.error(`Error getting retention policy: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if data should be purged
   */
  async shouldPurgeData(dataType, dataDate) {
    try {
      const policy = await this.getRetentionPolicy(dataType);
      
      if (!policy) {
        // Use default retention period
        const retentionDate = new Date(Date.now() - this.defaultRetentionDays * 24 * 60 * 60 * 1000);
        return dataDate < retentionDate;
      }

      const retentionDate = new Date(Date.now() - policy.retentionPeriodDays * 24 * 60 * 60 * 1000);
      return dataDate < retentionDate;
    } catch (error) {
      logger.error(`Error checking data purge status: ${error.message}`);
      return false;
    }
  }

  /**
   * Purge expired audit logs
   */
  async purgeAuditLogs() {
    try {
      const AuditLog = require('../models/AuditLog');
      const policy = await this.getRetentionPolicy('audit_logs');
      
      if (!policy || !policy.deleteAfterExpiry) {
        logger.info('Audit log purging not enabled');
        return { deleted: 0 };
      }

      const retentionDate = new Date(Date.now() - policy.retentionPeriodDays * 24 * 60 * 60 * 1000);

      const result = await AuditLog.deleteMany({
        createdAt: { $lt: retentionDate }
      });

      logger.info(`Purged ${result.deletedCount} expired audit logs`);

      return {
        deleted: result.deletedCount,
        retentionDate
      };
    } catch (error) {
      logger.error(`Error purging audit logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Archive expired data
   */
  async archiveExpiredData(dataType) {
    try {
      const policy = await this.getRetentionPolicy(dataType);
      
      if (!policy || !policy.archiveBeforeDelete) {
        return { archived: 0 };
      }

      logger.info(`Archiving expired data for ${dataType}`);

      // In production, this would move data to archive storage
      // For now, just log the action
      
      return {
        archived: 0,
        message: 'Archive functionality not implemented'
      };
    } catch (error) {
      logger.error(`Error archiving data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get retention summary
   */
  async getRetentionSummary() {
    try {
      const policies = await DataRetentionPolicy.find({ status: 'active' });

      const summary = {
        policies: policies.map(p => ({
          dataType: p.dataType,
          retentionDays: p.retentionPeriodDays,
          deleteAfterExpiry: p.deleteAfterExpiry,
          archiveBeforeDelete: p.archiveBeforeDelete
        })),
        defaultRetentionDays: this.defaultRetentionDays,
        generatedAt: new Date()
      };

      return summary;
    } catch (error) {
      logger.error(`Error getting retention summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize default retention policies
   */
  async initializeDefaultPolicies() {
    try {
      const defaultPolicies = [
        {
          dataType: 'audit_logs',
          retentionPeriodDays: 2555, // 7 years (regulatory requirement)
          description: 'Audit logs must be retained for 7 years',
          legalBasis: 'Financial regulations require 7-year retention',
          deleteAfterExpiry: false
        },
        {
          dataType: 'transaction_records',
          retentionPeriodDays: 2555, // 7 years
          description: 'Transaction records for regulatory compliance',
          legalBasis: 'AML/BSA regulations',
          deleteAfterExpiry: false
        },
        {
          dataType: 'kyc_documents',
          retentionPeriodDays: 1825, // 5 years
          description: 'KYC verification documents',
          legalBasis: 'AML regulations',
          deleteAfterExpiry: false
        },
        {
          dataType: 'user_sessions',
          retentionPeriodDays: 90,
          description: 'User session data',
          legalBasis: 'Security and fraud prevention',
          deleteAfterExpiry: true
        },
        {
          dataType: 'marketing_data',
          retentionPeriodDays: 730, // 2 years
          description: 'Marketing consent and communications',
          legalBasis: 'GDPR compliance',
          deleteAfterExpiry: true
        }
      ];

      for (const policyData of defaultPolicies) {
        await this.setRetentionPolicy(
          policyData.dataType,
          policyData.retentionPeriodDays,
          policyData
        );
      }

      logger.info('Default retention policies initialized');

      return {
        success: true,
        initialized: defaultPolicies.length
      };
    } catch (error) {
      logger.error(`Error initializing default policies: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run data retention cleanup
   */
  async runCleanup() {
    try {
      logger.info('Starting data retention cleanup');

      const results = {
        auditLogs: await this.purgeAuditLogs(),
        timestamp: new Date()
      };

      logger.info('Data retention cleanup completed');

      return results;
    } catch (error) {
      logger.error(`Error running cleanup: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new DataRetentionService();
