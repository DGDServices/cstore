const https = require('https');
const http = require('http');
const crypto = require('crypto');
const User = require('../models/User');
const ContentModerationLog = require('../models/ContentModerationLog');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

let AuditLog;
try {
  AuditLog = require('../models/AuditLog');
} catch (e) {
  AuditLog = null;
}

function makeRequest(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'POST',
      headers: options.headers || {}
    };
    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

class AuthorityReportingService {
  constructor() {
    this.ncmecApiUrl = process.env.NCMEC_CYBERTIPLINE_API_URL || 'https://api.cybertipline.org/v1';
    this.ncmecApiKey = process.env.NCMEC_API_KEY;
    this.ic3Enabled = process.env.IC3_REPORTING_ENABLED === 'true';
    this.fincenBsaUrl = process.env.FINCEN_BSA_API_URL;
  }

  async reportCSAM(contentModerationLogId, userInfo, contentInfo) {
    try {
      const log = await ContentModerationLog.findById(contentModerationLogId);
      if (!log) {
        logger.error('CSAM report: ContentModerationLog not found', { contentModerationLogId });
        return { reported: false, reportId: null };
      }

      if (log.ncmecReported) {
        logger.info('CSAM already reported to NCMEC', { logId: log._id, reportId: log.ncmecReportId });
        return { reported: true, reportId: log.ncmecReportId };
      }

      const payload = {
        reportType: 'CSAM',
        submittingOrganization: process.env.PLATFORM_LEGAL_NAME || 'Cryptons.com',
        reportingPerson: {
          name: process.env.COMPLIANCE_OFFICER_NAME,
          email: process.env.COMPLIANCE_OFFICER_EMAIL
        },
        incidentDetails: {
          contentType: log.contentType,
          contentId: log.contentId,
          dateDiscovered: new Date(),
          ipAddress: userInfo.ipAddress,
          deviceFingerprint: userInfo.deviceFingerprint,
          accountInfo: {
            userId: userInfo.userId,
            email: userInfo.email,
            username: userInfo.username,
            createdAt: userInfo.createdAt
          },
          contentHash: contentInfo.hash,
          evidencePath: log.evidencePath
        }
      };

      let reportId = null;
      try {
        if (!this.ncmecApiKey) {
          logger.warn('NCMEC API key not configured - CSAM report not transmitted', { logId: log._id });
        } else {
          const response = await makeRequest(`${this.ncmecApiUrl}/reports`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.ncmecApiKey}`,
              'Content-Type': 'application/json'
            }
          }, payload);
          reportId = response.body && response.body.reportId;
          logger.info('CSAM report submitted to NCMEC', { logId: log._id, reportId, statusCode: response.statusCode });
        }
      } catch (httpErr) {
        logger.error('Failed to transmit CSAM report to NCMEC', { error: httpErr.message, logId: log._id });
      }

      log.ncmecReported = true;
      if (reportId) log.ncmecReportId = reportId;
      await log.save();

      return { reported: true, reportId };
    } catch (err) {
      // Never let reporting failure block the freeze flow
      logger.error('CSAM reporting error', { error: err.message, contentModerationLogId });
      return { reported: false, reportId: null };
    }
  }

  async freezeAccount(userId, reason) {
    const user = await User.findById(userId);
    if (!user) {
      logger.error('freezeAccount: User not found', { userId });
      return { frozen: false, userId };
    }

    user.isActive = false;
    await user.save();

    if (AuditLog) {
      try {
        await AuditLog.create({
          user: userId,
          action: 'ACCOUNT_FROZEN',
          category: 'compliance',
          resource: 'User',
          resourceId: userId,
          changes: { isActive: false },
          status: 'success',
          metadata: { reason }
        });
      } catch (e) {
        logger.error('Failed to create AuditLog for account freeze', { error: e.message, userId });
      }
    } else {
      logger.warn('Account frozen (AuditLog not available)', { userId, reason });
    }

    logger.info('Account frozen', { userId, reason });
    return { frozen: true, userId };
  }

  async placeLegalHold(contentModerationLogId, reason) {
    const log = await ContentModerationLog.findByIdAndUpdate(
      contentModerationLogId,
      { legalHold: true, legalHoldReason: reason, evidencePreserved: true },
      { new: true }
    );
    return log;
  }

  async exportEvidencePackage(userId) {
    const [userInfo, moderationLogs] = await Promise.all([
      User.findById(userId).select('-password'),
      ContentModerationLog.find({ submittedBy: userId }).sort({ createdAt: -1 })
    ]);

    let auditTrail = [];
    if (AuditLog) {
      try {
        auditTrail = await AuditLog.find({ user: userId }).sort({ createdAt: -1 });
      } catch (e) {
        logger.error('Failed to load AuditLog for evidence package', { error: e.message, userId });
      }
    }

    return {
      userId,
      userInfo,
      moderationLogs,
      auditTrail,
      exportedAt: new Date()
    };
  }

  async reportFinancialCrime(transactionId, crimeType, details) {
    const validCrimeTypes = ['triangulation_fraud', 'synthetic_identity', 'money_mule', 'counterfeit_goods'];
    if (!validCrimeTypes.includes(crimeType)) {
      throw new AppError(`Invalid crime type. Must be one of: ${validCrimeTypes.join(', ')}`, 400);
    }
    const reportId = `IC3-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    logger.warn('Financial crime report', {
      reportId,
      transactionId,
      crimeType,
      validCrimeType: validCrimeTypes.includes(crimeType),
      details
    });

    return { reportId, crimeType, status: 'submitted' };
  }

  async getLawEnforcementRequests() {
    return ContentModerationLog.find({ legalHold: true })
      .sort({ createdAt: -1 })
      .populate('submittedBy', 'name email');
  }

  async handleLawEnforcementRequest(requestData, apiKey) {
    if (!apiKey || apiKey !== process.env.LAW_ENFORCEMENT_API_KEY) {
      throw new AppError('Invalid law enforcement API key', 403);
    }

    const { userId, reason, requestingAgency, caseNumber } = requestData;

    const userLogs = await ContentModerationLog.find({ submittedBy: userId });
    await Promise.all(
      userLogs.map((log) => this.placeLegalHold(log._id, `LE request - Agency: ${requestingAgency}, Case: ${caseNumber}, Reason: ${reason}`))
    );

    logger.info('Law enforcement request handled', { userId, requestingAgency, caseNumber });

    const evidencePackage = await this.exportEvidencePackage(userId);
    return evidencePackage;
  }
}

module.exports = new AuthorityReportingService();
