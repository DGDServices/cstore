const LegalDocument = require('../models/LegalDocument');
const logger = require('../utils/logger');

/**
 * Legal Documents Service
 * Manages legal documentation (Terms of Service, Privacy Policy, etc.)
 */
class LegalDocumentsService {
  constructor() {
    this.documentTypes = [
      'terms_of_service',
      'privacy_policy',
      'risk_disclosure',
      'aml_policy',
      'cookie_policy'
    ];
  }

  /**
   * Create a new legal document
   */
  async createDocument(documentData) {
    try {
      const document = new LegalDocument({
        type: documentData.type,
        version: documentData.version,
        title: documentData.title,
        content: documentData.content,
        effectiveDate: documentData.effectiveDate,
        expiryDate: documentData.expiryDate,
        status: documentData.status || 'draft',
        jurisdiction: documentData.jurisdiction || process.env.LEGAL_JURISDICTION || 'US',
        language: documentData.language || 'en',
        createdBy: documentData.createdBy
      });

      await document.save();

      logger.info(`Legal document created: ${document.type} v${document.version}`);

      return {
        success: true,
        document
      };
    } catch (error) {
      logger.error(`Error creating legal document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active document by type
   */
  async getActiveDocument(type, language = 'en') {
    try {
      const document = await LegalDocument.findOne({
        type,
        language,
        status: 'active',
        effectiveDate: { $lte: new Date() },
        $or: [
          { expiryDate: { $exists: false } },
          { expiryDate: { $gt: new Date() } }
        ]
      }).sort({ effectiveDate: -1 });

      return document;
    } catch (error) {
      logger.error(`Error getting active document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get document by version
   */
  async getDocumentByVersion(type, version) {
    try {
      const document = await LegalDocument.findOne({
        type,
        version
      });

      return document;
    } catch (error) {
      logger.error(`Error getting document by version: ${error.message}`);
      throw error;
    }
  }

  /**
   * Activate a document
   */
  async activateDocument(documentId, approvedBy) {
    try {
      const document = await LegalDocument.findById(documentId);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Deactivate previous versions
      await LegalDocument.updateMany(
        {
          type: document.type,
          language: document.language,
          status: 'active',
          _id: { $ne: documentId }
        },
        {
          status: 'archived',
          expiryDate: new Date()
        }
      );

      // Activate new document
      document.status = 'active';
      document.approvedBy = approvedBy;
      document.approvedAt = new Date();

      await document.save();

      logger.info(`Legal document activated: ${document.type} v${document.version}`);

      return {
        success: true,
        document
      };
    } catch (error) {
      logger.error(`Error activating document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get document history
   */
  async getDocumentHistory(type, language = 'en') {
    try {
      const documents = await LegalDocument.find({
        type,
        language
      })
        .sort({ effectiveDate: -1 })
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email');

      return documents;
    } catch (error) {
      logger.error(`Error getting document history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user needs to accept new terms
   */
  async needsAcceptance(userId, documentType) {
    try {
      const UserConsent = require('../models/UserConsent');
      
      const activeDoc = await this.getActiveDocument(documentType);
      if (!activeDoc) {
        return false;
      }

      const hasConsent = await UserConsent.findOne({
        user: userId,
        consentType: documentType,
        version: activeDoc.version,
        granted: true,
        revokedAt: { $exists: false }
      });

      return !hasConsent;
    } catch (error) {
      logger.error(`Error checking document acceptance: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate Terms of Service
   */
  async generateTermsOfService(companyInfo) {
    const content = `
# TERMS OF SERVICE

**Effective Date**: ${new Date().toLocaleDateString()}

## 1. Acceptance of Terms
By accessing and using Cryptons.com, you accept and agree to be bound by these Terms of Service.

## 2. Services
Cryptons.com provides a cryptocurrency trading platform that allows users to buy, sell, and trade digital assets.

## 3. User Obligations
- You must be at least 18 years old
- You must comply with all applicable laws
- You must provide accurate information

## 4. Prohibited Activities
- Money laundering
- Fraud or deceptive practices
- Market manipulation

## 5. Risk Disclosure
Cryptocurrency trading involves substantial risk of loss.

## 6. Limitation of Liability
Cryptons.com shall not be liable for any indirect, incidental, special, or consequential damages.

## 7. Governing Law
These terms shall be governed by the laws of ${companyInfo.jurisdiction || 'the United States'}.

For questions, contact: ${companyInfo.email || 'legal@cryptons.com'}
`;

    return content;
  }

  /**
   * Generate Privacy Policy
   */
  async generatePrivacyPolicy(companyInfo) {
    const content = `
# PRIVACY POLICY

**Effective Date**: ${new Date().toLocaleDateString()}

## 1. Information We Collect
- Personal identification information
- Transaction data
- Usage data

## 2. How We Use Your Information
- To provide and maintain our services
- To comply with legal obligations
- To detect and prevent fraud

## 3. Data Security
We implement appropriate security measures to protect your data.

## 4. Your Rights (GDPR)
- Right to access your data
- Right to rectification
- Right to erasure
- Right to data portability

## 5. Data Retention
We retain your data as required by law.

## 6. Contact Us
For privacy inquiries: ${companyInfo.privacyEmail || 'privacy@cryptons.com'}
`;

    return content;
  }

  /**
   * Generate Risk Disclosure
   */
  async generateRiskDisclosure() {
    const content = `
# RISK DISCLOSURE STATEMENT

**Effective Date**: ${new Date().toLocaleDateString()}

## Trading Risks
Cryptocurrency trading involves significant risk of loss. You should only trade with funds you can afford to lose.

## Market Volatility
Cryptocurrency markets are highly volatile and prices can change rapidly.

## Regulatory Risk
Cryptocurrency regulations are evolving and may affect your ability to trade.

## Security Risks
While we implement security measures, no system is completely secure.

## No Guarantee of Profit
Past performance does not guarantee future results.

By using our platform, you acknowledge that you understand these risks.
`;

    return content;
  }

  /**
   * Get all active documents
   */
  async getAllActiveDocuments(language = 'en') {
    try {
      const documents = {};

      for (const type of this.documentTypes) {
        documents[type] = await this.getActiveDocument(type, language);
      }

      return documents;
    } catch (error) {
      logger.error(`Error getting all active documents: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new LegalDocumentsService();
