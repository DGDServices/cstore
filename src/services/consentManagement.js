const UserConsent = require('../models/UserConsent');
const logger = require('../utils/logger');

/**
 * Consent Management Service
 * Manages user consent for data processing, marketing, etc.
 */
class ConsentManagementService {
  constructor() {
    this.consentTypes = [
      'terms_of_service',
      'privacy_policy',
      'marketing',
      'data_processing',
      'cookies'
    ];
  }

  /**
   * Record user consent
   */
  async recordConsent(userId, consentData) {
    try {
      const consent = new UserConsent({
        user: userId,
        consentType: consentData.type,
        version: consentData.version,
        granted: consentData.granted,
        grantedAt: consentData.granted ? new Date() : null,
        ipAddress: consentData.ipAddress,
        userAgent: consentData.userAgent,
        method: consentData.method || 'web'
      });

      await consent.save();

      logger.info(`Consent recorded for user ${userId}: ${consentData.type}`);

      return {
        success: true,
        consent
      };
    } catch (error) {
      logger.error(`Error recording consent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user has given consent
   */
  async hasConsent(userId, consentType, version = null) {
    try {
      const query = {
        user: userId,
        consentType,
        granted: true,
        revokedAt: { $exists: false }
      };

      if (version) {
        query.version = version;
      }

      const consent = await UserConsent.findOne(query).sort({ createdAt: -1 });

      return !!consent;
    } catch (error) {
      logger.error(`Error checking consent: ${error.message}`);
      return false;
    }
  }

  /**
   * Revoke consent
   */
  async revokeConsent(userId, consentType) {
    try {
      const consents = await UserConsent.find({
        user: userId,
        consentType,
        granted: true,
        revokedAt: { $exists: false }
      });

      for (const consent of consents) {
        consent.revokedAt = new Date();
        await consent.save();
      }

      logger.info(`Consent revoked for user ${userId}: ${consentType}`);

      return {
        success: true,
        revokedCount: consents.length
      };
    } catch (error) {
      logger.error(`Error revoking consent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all consents for a user
   */
  async getUserConsents(userId) {
    try {
      const consents = await UserConsent.find({ user: userId })
        .sort({ createdAt: -1 });

      const consentStatus = {};
      
      for (const type of this.consentTypes) {
        const latestConsent = consents.find(c => c.consentType === type);
        consentStatus[type] = {
          granted: latestConsent ? latestConsent.granted && !latestConsent.revokedAt : false,
          version: latestConsent?.version,
          grantedAt: latestConsent?.grantedAt,
          revokedAt: latestConsent?.revokedAt
        };
      }

      return consentStatus;
    } catch (error) {
      logger.error(`Error getting user consents: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update consent for new version
   */
  async updateConsentVersion(userId, consentType, newVersion) {
    try {
      // Check if user has already consented to this version
      const existingConsent = await UserConsent.findOne({
        user: userId,
        consentType,
        version: newVersion,
        granted: true
      });

      if (existingConsent) {
        return {
          success: true,
          message: 'User already consented to this version'
        };
      }

      // Create new consent record for new version
      const consent = new UserConsent({
        user: userId,
        consentType,
        version: newVersion,
        granted: false, // User needs to explicitly consent
        method: 'web'
      });

      await consent.save();

      return {
        success: true,
        requiresConsent: true,
        consent
      };
    } catch (error) {
      logger.error(`Error updating consent version: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get consent history
   */
  async getConsentHistory(userId, consentType = null) {
    try {
      const query = { user: userId };
      if (consentType) {
        query.consentType = consentType;
      }

      const history = await UserConsent.find(query)
        .sort({ createdAt: -1 })
        .limit(50);

      return history;
    } catch (error) {
      logger.error(`Error getting consent history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check required consents
   */
  async checkRequiredConsents(userId) {
    try {
      const requiredConsents = ['terms_of_service', 'privacy_policy'];
      const missing = [];

      for (const type of requiredConsents) {
        const hasConsent = await this.hasConsent(userId, type);
        if (!hasConsent) {
          missing.push(type);
        }
      }

      return {
        hasAllRequired: missing.length === 0,
        missing
      };
    } catch (error) {
      logger.error(`Error checking required consents: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ConsentManagementService();
