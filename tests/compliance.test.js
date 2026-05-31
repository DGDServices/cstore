const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const KYCVerification = require('../src/models/KYCVerification');
const AMLAlert = require('../src/models/AMLAlert');
const SanctionsScreening = require('../src/models/SanctionsScreening');
const ComplianceCase = require('../src/models/ComplianceCase');
const UserConsent = require('../src/models/UserConsent');
const User = require('../src/models/User');
const kycService = require('../src/services/kyc');
const amlService = require('../src/services/aml');
const sanctionsService = require('../src/services/sanctions');
const gdprService = require('../src/services/gdpr');
const consentManagement = require('../src/services/consentManagement');
const auditTrail = require('../src/services/auditTrail');

let mongoServer;

// Mock logger to avoid console output during tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Compliance Services', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('KYC Service', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        country: 'US'
      });
    });

    test('should start KYC verification', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: new Date('1990-01-01'),
        nationality: 'US',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'CA',
          country: 'US',
          postalCode: '12345'
        }
      };

      const result = await kycService.startVerification(testUser._id, userData);

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.verificationId).toBeDefined();

      const verification = await KYCVerification.findById(result.verificationId);
      expect(verification).toBeDefined();
      expect(verification.personalInfo.firstName).toBe('Test');
    });

    test('should calculate risk level correctly', () => {
      const lowRiskData = {
        dateOfBirth: new Date('1990-01-01'),
        address: { country: 'US' }
      };

      const highRiskData = {
        dateOfBirth: new Date('1990-01-01'),
        address: { country: 'IR' }
      };

      const lowRisk = kycService.calculateRiskLevel(lowRiskData);
      const highRisk = kycService.calculateRiskLevel(highRiskData);

      expect(lowRisk).toBe('low');
      expect(highRisk).toBe('high');
    });

    test('should update verification status', async () => {
      const verification = await KYCVerification.create({
        user: testUser._id,
        status: 'pending'
      });

      const result = await kycService.updateVerificationStatus(
        verification._id,
        'approved',
        'Verification complete',
        testUser._id
      );

      expect(result.success).toBe(true);
      expect(result.verification.status).toBe('approved');
      expect(result.verification.verifiedAt).toBeDefined();
    });

    test('should check verification status', async () => {
      await KYCVerification.create({
        user: testUser._id,
        status: 'approved',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      const status = await kycService.checkVerificationStatus(testUser._id);

      expect(status.verified).toBe(true);
      expect(status.status).toBe('approved');
    });
  });

  describe('AML Service', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'aml@example.com',
        password: 'password123',
        name: 'AML Test User',
        country: 'US'
      });
    });

    test('should create alert for large transaction', async () => {
      const transaction = {
        _id: new mongoose.Types.ObjectId(),
        user: testUser._id,
        fiatAmount: 15000,
        status: 'pending'
      };

      const result = await amlService.monitorTransaction(transaction);

      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts[0].type).toBe('CTR_REQUIRED');
    });

    test('should detect structuring', async () => {
      // Create multiple transactions just below threshold
      const ConversionTransaction = require('../src/models/ConversionTransaction');
      
      for (let i = 0; i < 3; i++) {
        await ConversionTransaction.create({
          user: testUser._id,
          cryptocurrency: 'BTC',
          cryptoAmount: 0.5,
          fiatCurrency: 'USD',
          fiatAmount: 9500,
          status: 'completed',
          createdAt: new Date()
        });
      }

      const structuring = await amlService.detectStructuring(testUser._id, {
        fiatAmount: 9500
      });

      expect(structuring).toBeDefined();
      expect(structuring.count).toBeGreaterThanOrEqual(3);
    });

    test('should resolve alert', async () => {
      const alert = await AMLAlert.create({
        user: testUser._id,
        type: 'LARGE_TRANSACTION',
        severity: 'medium',
        status: 'open'
      });

      const result = await amlService.resolveAlert(alert._id, {
        action: 'approved',
        notes: 'Transaction verified',
        resolvedBy: testUser._id
      });

      expect(result.status).toBe('resolved');
      expect(result.resolution.action).toBe('approved');
    });
  });

  describe('Sanctions Screening Service', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'sanctions@example.com',
        password: 'password123',
        name: 'Sanctions Test',
        country: 'US'
      });
    });

    test('should clear low-risk user', async () => {
      const userData = {
        name: 'John Doe',
        country: 'US'
      };

      const result = await sanctionsService.screenUser(testUser._id, userData);

      expect(result.result).toBe('clear');
      expect(result.action).toBe('allow');
    });

    test('should flag sanctioned country', async () => {
      const userData = {
        name: 'Test User',
        country: 'IR' // Iran - sanctioned country
      };

      const result = await sanctionsService.screenUser(testUser._id, userData);

      expect(result.result).toBe('confirmed_match');
      expect(result.action).toBe('block');
    });

    test('should get screening history', async () => {
      await SanctionsScreening.create({
        user: testUser._id,
        result: 'clear',
        action: 'allow'
      });

      const history = await sanctionsService.getScreeningHistory(testUser._id);

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].result).toBe('clear');
    });
  });

  describe('GDPR Service', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'gdpr@example.com',
        password: 'password123',
        name: 'GDPR Test User',
        country: 'GB'
      });
    });

    test('should handle data access request', async () => {
      const result = await gdprService.handleDataAccessRequest(testUser._id);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.personalData).toBeDefined();
    });

    test('should handle rectification request', async () => {
      const updates = {
        name: 'Updated Name',
        preferredCurrency: 'EUR'
      };

      const result = await gdprService.handleRectificationRequest(testUser._id, updates);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.name).toBe('Updated Name');
    });

    test('should check if data can be erased', async () => {
      const canErase = await gdprService.canEraseUserData(testUser._id);

      expect(canErase.allowed).toBeDefined();
    });

    test('should anonymize user data', async () => {
      await gdprService.anonymizeUserData(testUser._id);

      const user = await User.findById(testUser._id);
      expect(user.name).toBe('Deleted User');
      expect(user.isActive).toBe(false);
    });
  });

  describe('Consent Management Service', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'consent@example.com',
        password: 'password123',
        name: 'Consent Test User'
      });
    });

    test('should record consent', async () => {
      const consentData = {
        type: 'terms_of_service',
        version: '1.0',
        granted: true,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      };

      const result = await consentManagement.recordConsent(testUser._id, consentData);

      expect(result.success).toBe(true);
      expect(result.consent).toBeDefined();
      expect(result.consent.granted).toBe(true);
    });

    test('should check if user has consent', async () => {
      await UserConsent.create({
        user: testUser._id,
        consentType: 'privacy_policy',
        version: '1.0',
        granted: true
      });

      const hasConsent = await consentManagement.hasConsent(testUser._id, 'privacy_policy');

      expect(hasConsent).toBe(true);
    });

    test('should revoke consent', async () => {
      await UserConsent.create({
        user: testUser._id,
        consentType: 'marketing',
        version: '1.0',
        granted: true
      });

      const result = await consentManagement.revokeConsent(testUser._id, 'marketing');

      expect(result.success).toBe(true);
      expect(result.revokedCount).toBe(1);
    });

    test('should get user consents', async () => {
      await UserConsent.create({
        user: testUser._id,
        consentType: 'terms_of_service',
        version: '1.0',
        granted: true
      });

      const consents = await consentManagement.getUserConsents(testUser._id);

      expect(consents).toBeDefined();
      expect(consents.terms_of_service.granted).toBe(true);
    });

    test('should check required consents', async () => {
      const result = await consentManagement.checkRequiredConsents(testUser._id);

      expect(result.hasAllRequired).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Trail Service', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'audit@example.com',
        password: 'password123',
        name: 'Audit Test User'
      });
    });

    test('should log audit event', async () => {
      await auditTrail.log({
        userId: testUser._id,
        action: 'login',
        category: 'auth',
        resource: 'authentication',
        status: 'success',
        ipAddress: '127.0.0.1'
      });

      const logs = await auditTrail.getUserActivity(testUser._id);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('login');
    });

    test('should log authentication event', async () => {
      await auditTrail.logAuth(testUser._id, 'login', 'success', '127.0.0.1', 'Test Agent');

      const logs = await auditTrail.getLogs({ category: 'auth' });

      expect(logs.length).toBeGreaterThan(0);
    });

    test('should get resource audit trail', async () => {
      const resourceId = new mongoose.Types.ObjectId();

      await auditTrail.log({
        userId: testUser._id,
        action: 'update',
        category: 'user',
        resource: 'profile',
        resourceId,
        status: 'success'
      });

      const trail = await auditTrail.getResourceAuditTrail('profile', resourceId);

      expect(trail.length).toBeGreaterThan(0);
    });

    test('should generate audit report', async () => {
      await auditTrail.log({
        userId: testUser._id,
        action: 'test_action',
        category: 'system',
        resource: 'test',
        status: 'success'
      });

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await auditTrail.generateReport(startDate, endDate);

      expect(report.period).toBeDefined();
      expect(report.statistics).toBeDefined();
    });
  });

  describe('Compliance Case Management', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'case@example.com',
        password: 'password123',
        name: 'Case Test User'
      });
    });

    test('should create compliance case', async () => {
      const caseData = {
        type: 'KYC',
        userId: testUser._id,
        priority: 'high',
        description: 'Test case'
      };

      const complianceCase = await ComplianceCase.create(caseData);

      expect(complianceCase).toBeDefined();
      expect(complianceCase.caseNumber).toBeDefined();
      expect(complianceCase.type).toBe('KYC');
    });

    test('should generate case number automatically', async () => {
      const case1 = await ComplianceCase.create({
        type: 'AML',
        user: testUser._id,
        description: 'Test case 1'
      });

      const case2 = await ComplianceCase.create({
        type: 'AML',
        user: testUser._id,
        description: 'Test case 2'
      });

      expect(case1.caseNumber).toBeDefined();
      expect(case2.caseNumber).toBeDefined();
      expect(case1.caseNumber).not.toBe(case2.caseNumber);
    });
  });
});
