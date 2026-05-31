const KYCVerification = require('../models/KYCVerification');
const logger = require('../utils/logger');

/**
 * KYC Service
 * Manages customer identity verification and Know Your Customer compliance
 */
class KYCService {
  constructor() {
    this.providers = {
      jumio: this.initJumio(),
      onfido: this.initOnfido(),
      sumsub: this.initSumsub()
    };
  }

  /**
   * Initialize Jumio provider
   */
  initJumio() {
    const apiToken = process.env.JUMIO_API_TOKEN;
    const apiSecret = process.env.JUMIO_API_SECRET;
    
    if (!apiToken || !apiSecret) {
      logger.warn('Jumio credentials not configured');
      return null;
    }

    return {
      name: 'jumio',
      startVerification: async (userId, _userData) => {
        // Integration with Jumio Web SDK
        logger.info(`Starting Jumio verification for user ${userId}`);
        return {
          provider: 'jumio',
          reference: `JUMIO-${Date.now()}`,
          redirectUrl: `${process.env.APP_URL}/kyc/jumio/callback`
        };
      },
      checkStatus: async (reference) => {
        // Check verification status from Jumio
        logger.info(`Checking Jumio verification status: ${reference}`);
        return { status: 'pending' };
      }
    };
  }

  /**
   * Initialize Onfido provider
   */
  initOnfido() {
    const apiToken = process.env.ONFIDO_API_TOKEN;
    
    if (!apiToken) {
      logger.warn('Onfido credentials not configured');
      return null;
    }

    return {
      name: 'onfido',
      startVerification: async (userId, _userData) => {
        logger.info(`Starting Onfido verification for user ${userId}`);
        return {
          provider: 'onfido',
          reference: `ONFIDO-${Date.now()}`,
          redirectUrl: `${process.env.APP_URL}/kyc/onfido/callback`
        };
      },
      checkStatus: async (reference) => {
        logger.info(`Checking Onfido verification status: ${reference}`);
        return { status: 'pending' };
      }
    };
  }

  /**
   * Initialize Sumsub provider
   */
  initSumsub() {
    const appToken = process.env.SUMSUB_APP_TOKEN;
    
    if (!appToken) {
      logger.warn('Sumsub credentials not configured');
      return null;
    }

    return {
      name: 'sumsub',
      startVerification: async (userId, _userData) => {
        logger.info(`Starting Sumsub verification for user ${userId}`);
        return {
          provider: 'sumsub',
          reference: `SUMSUB-${Date.now()}`,
          redirectUrl: `${process.env.APP_URL}/kyc/sumsub/callback`
        };
      },
      checkStatus: async (reference) => {
        logger.info(`Checking Sumsub verification status: ${reference}`);
        return { status: 'pending' };
      }
    };
  }

  /**
   * Start KYC verification for a user
   */
  async startVerification(userId, userData, providerName = 'manual') {
    try {
      // Check if verification already exists
      let verification = await KYCVerification.findOne({ user: userId });
      
      if (verification && verification.status === 'approved') {
        return {
          success: false,
          message: 'User already verified'
        };
      }

      // Create or update verification record
      if (!verification) {
        verification = new KYCVerification({
          user: userId,
          status: 'pending',
          provider: providerName
        });
      }

      // Update personal info
      if (userData) {
        verification.personalInfo = {
          firstName: userData.firstName,
          lastName: userData.lastName,
          dateOfBirth: userData.dateOfBirth,
          nationality: userData.nationality,
          address: userData.address
        };
      }

      // Calculate initial risk level
      verification.riskLevel = this.calculateRiskLevel(userData);

      // Start verification with provider
      if (providerName !== 'manual' && this.providers[providerName]) {
        const providerResult = await this.providers[providerName].startVerification(userId, userData);
        verification.providerReference = providerResult.reference;
        verification.verificationMethod = 'automated';
      } else {
        verification.verificationMethod = 'manual';
      }

      await verification.save();

      logger.info(`KYC verification started for user ${userId}`);

      return {
        success: true,
        verificationId: verification._id,
        status: verification.status,
        provider: providerName
      };
    } catch (error) {
      logger.error(`Error starting KYC verification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate risk level based on user data
   */
  calculateRiskLevel(userData) {
    // Simple risk scoring - can be enhanced
    let riskScore = 0;

    // High-risk countries (simplified list)
    const highRiskCountries = ['IR', 'KP', 'SY', 'CU'];
    if (userData?.address?.country && highRiskCountries.includes(userData.address.country)) {
      riskScore += 50;
    }

    // Age-based risk
    if (userData?.dateOfBirth) {
      const age = Math.floor((Date.now() - new Date(userData.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 21 || age > 70) {
        riskScore += 20;
      }
    }

    if (riskScore >= 50) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }

  /**
   * Update verification status
   */
  async updateVerificationStatus(verificationId, status, notes, verifiedBy) {
    try {
      const verification = await KYCVerification.findById(verificationId);
      
      if (!verification) {
        throw new Error('Verification not found');
      }

      verification.status = status;
      verification.notes = notes;
      
      if (status === 'approved') {
        verification.verifiedAt = new Date();
        verification.verifiedBy = verifiedBy;
        // Set expiry date (e.g., 1 year from verification)
        verification.expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }

      if (status === 'rejected') {
        verification.rejectionReason = notes;
      }

      await verification.save();

      logger.info(`KYC verification ${verificationId} updated to ${status}`);

      return {
        success: true,
        verification
      };
    } catch (error) {
      logger.error(`Error updating KYC verification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check verification status
   */
  async checkVerificationStatus(userId) {
    try {
      const verification = await KYCVerification.findOne({ user: userId });
      
      if (!verification) {
        return {
          verified: false,
          status: 'not_started'
        };
      }

      // Check if verification is expired
      if (verification.expiryDate && verification.expiryDate < new Date()) {
        verification.status = 'expired';
        await verification.save();
      }

      return {
        verified: verification.status === 'approved',
        status: verification.status,
        riskLevel: verification.riskLevel,
        expiryDate: verification.expiryDate
      };
    } catch (error) {
      logger.error(`Error checking KYC status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get verification details
   */
  async getVerification(userId) {
    try {
      const verification = await KYCVerification.findOne({ user: userId })
        .populate('user', 'name email')
        .populate('verifiedBy', 'name email');
      
      return verification;
    } catch (error) {
      logger.error(`Error getting KYC verification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Submit documents
   */
  async submitDocuments(userId, documents) {
    try {
      const verification = await KYCVerification.findOne({ user: userId });
      
      if (!verification) {
        throw new Error('Verification not found');
      }

      verification.documents = documents.map(doc => ({
        type: doc.type,
        documentNumber: doc.documentNumber,
        expiryDate: doc.expiryDate,
        uploadedFile: doc.filePath,
        verificationStatus: 'pending'
      }));

      verification.status = 'in_review';
      await verification.save();

      logger.info(`Documents submitted for user ${userId}`);

      return {
        success: true,
        verification
      };
    } catch (error) {
      logger.error(`Error submitting documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform enhanced due diligence
   */
  async performEnhancedDueDiligence(userId) {
    try {
      const verification = await KYCVerification.findOne({ user: userId });
      
      if (!verification) {
        throw new Error('Verification not found');
      }

      // Mark as requiring enhanced due diligence
      verification.riskLevel = 'high';
      verification.notes = (verification.notes || '') + '\nEnhanced Due Diligence Required';
      
      await verification.save();

      logger.info(`Enhanced due diligence initiated for user ${userId}`);

      return {
        success: true,
        message: 'Enhanced due diligence process started'
      };
    } catch (error) {
      logger.error(`Error performing enhanced due diligence: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new KYCService();
