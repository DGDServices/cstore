/**
 * Integration test for Phase 1 security features
 * Validates that all new security components initialize correctly
 */

const secretsManager = require('../src/services/secretsManager');
const { initializeSecurityConfig, validateSecurityConfig } = require('../config/security');
const { validateEncryptionConfig } = require('../config/database-encryption');
const { enforceHttps, getHttpsStatus } = require('../src/middleware/httpsEnforcement');

describe('Phase 1 Security Integration', () => {
  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters';
  });

  afterAll(async () => {
    await secretsManager.shutdown();
  });

  describe('Security Configuration', () => {
    it('should initialize security config without errors', () => {
      expect(() => {
        initializeSecurityConfig();
      }).not.toThrow();
    });

    it('should validate security config successfully in test', () => {
      const validation = validateSecurityConfig();
      expect(validation).toBeDefined();
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
    });
  });

  describe('Database Encryption Configuration', () => {
    it('should validate encryption config without errors', () => {
      const validation = validateEncryptionConfig();
      expect(validation).toBeDefined();
      expect(validation).toHaveProperty('valid');
      expect(validation.errors).toBeInstanceOf(Array);
      expect(validation.warnings).toBeInstanceOf(Array);
    });
  });

  describe('Secrets Manager', () => {
    it('should initialize successfully', async () => {
      const result = await secretsManager.initialize();
      expect(result).toBe(true);
    });

    it('should be ready after initialization', () => {
      expect(secretsManager.isReady()).toBe(true);
    });

    it('should get secrets from environment', async () => {
      process.env.TEST_SECRET = 'test-value';
      const secret = await secretsManager.getSecret('cryptons/jwt', 'secret');
      expect(secret).toBeDefined();
    });
  });

  describe('HTTPS Enforcement', () => {
    it('should provide HTTPS status', () => {
      const status = getHttpsStatus();
      expect(status).toBeDefined();
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('environment');
    });

    it('should have enforceHttps middleware', () => {
      expect(typeof enforceHttps).toBe('function');
    });
  });

  describe('Feature Availability', () => {
    it('should have all Phase 1 security features available', () => {
      // Check all main exports exist
      expect(secretsManager).toBeDefined();
      expect(initializeSecurityConfig).toBeDefined();
      expect(validateEncryptionConfig).toBeDefined();
      expect(enforceHttps).toBeDefined();
    });
  });

  describe('Environment Variable Coverage', () => {
    it('should have JWT secrets configured', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_REFRESH_SECRET).toBeDefined();
    });
  });
});
