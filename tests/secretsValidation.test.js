const {
  validateSecrets,
  validateSecretStrength,
  isMongoAuthEnabled,
  isMongoTLSEnabled,
  getSecuritySummary
} = require('../src/utils/secretsValidation');

describe('Secrets Validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      if (!originalEnv[key]) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
  });

  describe('validateSecretStrength', () => {
    it('should accept strong secrets', () => {
      const strongSecret = 'a'.repeat(32) + 'b'.repeat(20); // 52 chars, high entropy
      const result = validateSecretStrength(strongSecret);
      
      expect(result.valid).toBe(true);
    });

    it('should reject short secrets', () => {
      const shortSecret = 'tooshort';
      const result = validateSecretStrength(shortSecret);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('should reject insecure defaults', () => {
      const result1 = validateSecretStrength('your-secret-key-change-in-production');
      const result2 = validateSecretStrength('default-password-12345');
      
      expect(result1.valid).toBe(false);
      expect(result1.reason).toContain('insecure default');
      expect(result2.valid).toBe(false);
    });

    it('should reject low entropy secrets', () => {
      const lowEntropy = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 36 chars, all same
      const result = validateSecretStrength(lowEntropy);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('entropy');
    });

    it('should reject empty secrets', () => {
      const result1 = validateSecretStrength('');
      const result2 = validateSecretStrength(null);
      const result3 = validateSecretStrength(undefined);
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result3.valid).toBe(false);
    });
  });

  describe('validateSecrets', () => {
    it('should skip validation in development', () => {
      process.env.NODE_ENV = 'development';
      
      const results = validateSecrets();
      
      expect(results.valid).toBe(true);
      expect(results.errors.length).toBe(0);
      expect(results.environment).toBe('development');
    });

    it('should validate critical secrets in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;
      delete process.env.MONGODB_URI;
      
      const results = validateSecrets();
      
      expect(results.valid).toBe(false);
      expect(results.errors.length).toBeGreaterThan(0);
    });

    it('should warn about missing recommended secrets', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(40) + 'b'.repeat(10);
      process.env.JWT_REFRESH_SECRET = 'c'.repeat(40) + 'd'.repeat(10);
      process.env.MONGODB_URI = 'mongodb://localhost:27017/db';
      delete process.env.WEBHOOK_SECRET;
      
      const results = validateSecrets();
      
      expect(results.warnings.length).toBeGreaterThan(0);
    });

    it('should pass with all valid secrets', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(40) + 'b'.repeat(10);
      process.env.JWT_REFRESH_SECRET = 'c'.repeat(40) + 'd'.repeat(10);
      process.env.MONGODB_URI = 'mongodb://user:pass@localhost:27017/db';
      process.env.WEBHOOK_SECRET = 'e'.repeat(40) + 'f'.repeat(10);
      process.env.FIELD_ENCRYPTION_KEY = 'g'.repeat(40) + 'h'.repeat(10);
      
      const results = validateSecrets();
      
      expect(results.errors.length).toBe(0);
    });
  });

  describe('MongoDB Security Checks', () => {
    it('should detect MongoDB authentication', () => {
      process.env.MONGODB_URI = 'mongodb://user:password@localhost:27017/db';
      expect(isMongoAuthEnabled()).toBe(true);

      process.env.MONGODB_URI = 'mongodb://localhost:27017/db';
      expect(isMongoAuthEnabled()).toBe(false);
    });

    it('should detect MongoDB TLS', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/db?tls=true';
      expect(isMongoTLSEnabled()).toBe(true);

      process.env.MONGODB_URI = 'mongodb://localhost:27017/db?ssl=true';
      expect(isMongoTLSEnabled()).toBe(true);

      process.env.MONGODB_URI = 'mongodb://localhost:27017/db';
      expect(isMongoTLSEnabled()).toBe(false);
    });

    it('should handle missing MongoDB URI', () => {
      delete process.env.MONGODB_URI;
      
      expect(isMongoAuthEnabled()).toBe(false);
      expect(isMongoTLSEnabled()).toBe(false);
    });
  });

  describe('getSecuritySummary', () => {
    it('should return security configuration summary', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'test-secret';
      process.env.WEBHOOK_SECRET = 'test-webhook-secret';
      
      const summary = getSecuritySummary();
      
      expect(summary).toHaveProperty('environment');
      expect(summary).toHaveProperty('jwtConfigured');
      expect(summary).toHaveProperty('webhookSecurityEnabled');
      expect(summary).toHaveProperty('redisEnabled');
      expect(summary).toHaveProperty('encryptionEnabled');
      expect(summary).toHaveProperty('mongoAuth');
      expect(summary).toHaveProperty('mongoTLS');
      expect(summary).toHaveProperty('corsConfigured');
      expect(summary).toHaveProperty('productionReady');
    });

    it('should check JWT configuration', () => {
      process.env.JWT_SECRET = 'test-secret';
      const summary = getSecuritySummary();
      
      expect(summary.jwtConfigured).toBe(true);
    });

    it('should check webhook security', () => {
      process.env.WEBHOOK_SECRET = 'test-webhook-secret';
      const summary = getSecuritySummary();
      
      expect(summary.webhookSecurityEnabled).toBe(true);
    });

    it('should check Redis status', () => {
      process.env.REDIS_ENABLED = 'true';
      const summary = getSecuritySummary();
      
      expect(summary.redisEnabled).toBe(true);
    });

    it('should check encryption status', () => {
      process.env.FIELD_ENCRYPTION_KEY = 'test-encryption-key';
      const summary = getSecuritySummary();
      
      expect(summary.encryptionEnabled).toBe(true);
    });

    it('should check CORS configuration', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      const summary = getSecuritySummary();
      
      expect(summary.corsConfigured).toBe(true);
    });
  });
});
