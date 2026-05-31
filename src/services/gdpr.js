const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * GDPR Service
 * Implements GDPR data subject rights (access, rectification, erasure, portability)
 */
class GDPRService {
  constructor() {
    this.enabled = process.env.GDPR_ENABLED === 'true';
    this.dataControllerEmail = process.env.DATA_CONTROLLER_EMAIL || 'privacy@cryptons.com';
  }

  /**
   * Handle data access request (Right to Access)
   */
  async handleDataAccessRequest(userId) {
    try {
      logger.info(`Processing data access request for user ${userId}`);

      // Collect all user data
      const userData = await this.collectUserData(userId);

      // Log the access request
      await this.logDataRequest(userId, 'access', 'success');

      return {
        success: true,
        data: userData,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error processing data access request: ${error.message}`);
      await this.logDataRequest(userId, 'access', 'error', error.message);
      throw error;
    }
  }

  /**
   * Collect all user data for export
   */
  async collectUserData(userId) {
    try {
      const User = require('../models/User');
      const ConversionTransaction = require('../models/ConversionTransaction');
      const Order = require('../models/Order');
      const KYCVerification = require('../models/KYCVerification');
      const UserConsent = require('../models/UserConsent');

      const user = await User.findById(userId).select('-password');
      const transactions = await ConversionTransaction.find({ user: userId });
      const orders = await Order.find({ user: userId });
      const kyc = await KYCVerification.findOne({ user: userId });
      const consents = await UserConsent.find({ user: userId });

      return {
        personalData: user,
        transactions,
        orders,
        kycVerification: kyc,
        consents,
        exportedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error collecting user data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle data rectification request (Right to Rectification)
   */
  async handleRectificationRequest(userId, updates) {
    try {
      logger.info(`Processing rectification request for user ${userId}`);

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update allowed fields
      const allowedFields = ['name', 'preferredCurrency', 'preferredLanguage'];
      const changes = {};

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          changes[field] = {
            old: user[field],
            new: updates[field]
          };
          user[field] = updates[field];
        }
      }

      await user.save();

      // Log the rectification
      await this.logDataRequest(userId, 'rectification', 'success', null, changes);

      return {
        success: true,
        changes,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error processing rectification request: ${error.message}`);
      await this.logDataRequest(userId, 'rectification', 'error', error.message);
      throw error;
    }
  }

  /**
   * Handle data erasure request (Right to Erasure / Right to be Forgotten)
   */
  async handleErasureRequest(userId, reason) {
    try {
      logger.info(`Processing erasure request for user ${userId}`);

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if erasure is allowed (e.g., no pending transactions, legal holds)
      const canErase = await this.canEraseUserData(userId);
      
      if (!canErase.allowed) {
        return {
          success: false,
          reason: canErase.reason,
          canRetryAfter: canErase.canRetryAfter
        };
      }

      // Anonymize user data instead of deleting (for regulatory compliance)
      await this.anonymizeUserData(userId);

      // Log the erasure
      await this.logDataRequest(userId, 'erasure', 'success', reason);

      return {
        success: true,
        message: 'User data has been anonymized',
        processedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error processing erasure request: ${error.message}`);
      await this.logDataRequest(userId, 'erasure', 'error', error.message);
      throw error;
    }
  }

  /**
   * Check if user data can be erased
   */
  async canEraseUserData(userId) {
    try {
      const ConversionTransaction = require('../models/ConversionTransaction');
      
      // Check for pending transactions
      const pendingTransactions = await ConversionTransaction.countDocuments({
        user: userId,
        status: { $in: ['pending', 'processing'] }
      });

      if (pendingTransactions > 0) {
        return {
          allowed: false,
          reason: 'User has pending transactions',
          canRetryAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        };
      }

      // Check for legal holds
      const AMLAlert = require('../models/AMLAlert');
      const openAlerts = await AMLAlert.countDocuments({
        user: userId,
        status: { $in: ['open', 'under_review', 'escalated'] }
      });

      if (openAlerts > 0) {
        return {
          allowed: false,
          reason: 'User has open compliance alerts',
          canRetryAfter: null // Cannot determine
        };
      }

      return {
        allowed: true
      };
    } catch (error) {
      logger.error(`Error checking erasure eligibility: ${error.message}`);
      return {
        allowed: false,
        reason: 'Error checking eligibility'
      };
    }
  }

  /**
   * Anonymize user data
   */
  async anonymizeUserData(userId) {
    try {
      const user = await User.findById(userId);
      
      // Anonymize personal data
      user.email = `deleted-${userId}@deleted.local`;
      user.name = 'Deleted User';
      user.isActive = false;
      user.country = null;
      user.walletAddresses = [];

      await user.save();

      logger.info(`User ${userId} data anonymized`);
    } catch (error) {
      logger.error(`Error anonymizing user data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle data portability request (Right to Data Portability)
   */
  async handlePortabilityRequest(userId, format = 'json') {
    try {
      logger.info(`Processing portability request for user ${userId}`);

      const userData = await this.collectUserData(userId);

      let exportData;
      
      if (format === 'json') {
        exportData = JSON.stringify(userData, null, 2);
      } else if (format === 'csv') {
        exportData = this.convertToCSV(userData);
      } else {
        throw new Error('Unsupported export format');
      }

      // Log the portability request
      await this.logDataRequest(userId, 'portability', 'success');

      return {
        success: true,
        data: exportData,
        format,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error processing portability request: ${error.message}`);
      await this.logDataRequest(userId, 'portability', 'error', error.message);
      throw error;
    }
  }

  /**
   * Convert user data to CSV format
   */
  convertToCSV(userData) {
    // Simplified CSV conversion
    const csvLines = [];
    csvLines.push('Type,Field,Value');
    
    if (userData.personalData) {
      Object.keys(userData.personalData.toObject()).forEach(key => {
        if (key !== '_id' && key !== '__v') {
          csvLines.push(`Personal,${key},${userData.personalData[key]}`);
        }
      });
    }

    return csvLines.join('\n');
  }

  /**
   * Log GDPR data request
   */
  async logDataRequest(userId, requestType, status, notes = null, changes = null) {
    try {
      const auditLog = new AuditLog({
        user: userId,
        action: `gdpr_${requestType}_request`,
        category: 'compliance',
        resource: 'user_data',
        resourceId: userId,
        status,
        changes,
        metadata: {
          requestType,
          notes
        }
      });

      await auditLog.save();
    } catch (error) {
      logger.error(`Error logging data request: ${error.message}`);
    }
  }

  /**
   * Handle objection to processing (Right to Object)
   */
  async handleObjectionRequest(userId, processingType) {
    try {
      logger.info(`Processing objection request for user ${userId}`);

      // Update user preferences to stop certain processing
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // This would update specific processing preferences
      // For now, simplified implementation

      await this.logDataRequest(userId, 'objection', 'success', processingType);

      return {
        success: true,
        message: 'Processing objection recorded',
        processedAt: new Date()
      };
    } catch (error) {
      logger.error(`Error processing objection request: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new GDPRService();
