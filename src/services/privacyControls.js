const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Privacy Controls Service
 * Manages user privacy settings and data protection
 */
class PrivacyControlsService {
  constructor() {
    this.defaultSettings = {
      profileVisibility: 'private',
      shareDataWithThirdParties: false,
      marketingEmails: false,
      transactionHistory: 'private',
      analyticsTracking: false
    };
  }

  /**
   * Initialize privacy settings for a user
   */
  async initializePrivacySettings(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Initialize with default privacy settings
      user.privacySettings = this.defaultSettings;
      await user.save();

      logger.info(`Privacy settings initialized for user ${userId}`);

      return {
        success: true,
        settings: user.privacySettings
      };
    } catch (error) {
      logger.error(`Error initializing privacy settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user privacy settings
   */
  async getPrivacySettings(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return user.privacySettings || this.defaultSettings;
    } catch (error) {
      logger.error(`Error getting privacy settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(userId, settings) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Merge with existing settings
      user.privacySettings = {
        ...user.privacySettings,
        ...settings
      };

      await user.save();

      logger.info(`Privacy settings updated for user ${userId}`);

      return {
        success: true,
        settings: user.privacySettings
      };
    } catch (error) {
      logger.error(`Error updating privacy settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user allows data sharing
   */
  async canShareData(userId, purpose) {
    try {
      const settings = await this.getPrivacySettings(userId);

      switch (purpose) {
        case 'marketing':
          return settings.marketingEmails === true;
        case 'third_party':
          return settings.shareDataWithThirdParties === true;
        case 'analytics':
          return settings.analyticsTracking === true;
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Error checking data sharing permission: ${error.message}`);
      return false;
    }
  }

  /**
   * Anonymize user data
   */
  async anonymizeUserData(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Anonymize personal identifiable information
      user.email = `deleted-${userId}@anonymized.local`;
      user.name = 'Anonymous User';
      user.country = null;
      user.walletAddresses = [];
      user.isActive = false;

      await user.save();

      logger.info(`User data anonymized for ${userId}`);

      return {
        success: true,
        message: 'User data has been anonymized'
      };
    } catch (error) {
      logger.error(`Error anonymizing user data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export user data in privacy-compliant format
   */
  async exportUserData(userId) {
    try {
      const ConversionTransaction = require('../models/ConversionTransaction');
      const KYCVerification = require('../models/KYCVerification');
      const UserConsent = require('../models/UserConsent');

      const user = await User.findById(userId).select('-password');
      const transactions = await ConversionTransaction.find({ user: userId })
        .select('-__v');
      const kyc = await KYCVerification.findOne({ user: userId })
        .select('-__v');
      const consents = await UserConsent.find({ user: userId })
        .select('-__v');

      const exportData = {
        personal_information: user,
        transactions,
        kyc_verification: kyc,
        consents,
        exported_at: new Date(),
        export_format: 'JSON'
      };

      logger.info(`User data exported for ${userId}`);

      return exportData;
    } catch (error) {
      logger.error(`Error exporting user data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restrict data processing
   */
  async restrictDataProcessing(userId, restrictions) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.dataProcessingRestrictions = restrictions;
      await user.save();

      logger.info(`Data processing restrictions applied for user ${userId}`);

      return {
        success: true,
        restrictions
      };
    } catch (error) {
      logger.error(`Error restricting data processing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check privacy compliance
   */
  async checkPrivacyCompliance(userId) {
    try {
      const consentManagement = require('./consentManagement');
      
      const requiredConsents = await consentManagement.checkRequiredConsents(userId);
      const settings = await this.getPrivacySettings(userId);

      const compliance = {
        hasRequiredConsents: requiredConsents.hasAllRequired,
        missingConsents: requiredConsents.missing,
        privacySettingsConfigured: !!settings,
        compliant: requiredConsents.hasAllRequired && !!settings
      };

      return compliance;
    } catch (error) {
      logger.error(`Error checking privacy compliance: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PrivacyControlsService();
