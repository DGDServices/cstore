const secretsManager = require('../src/services/secretsManager');

describe('Secrets Manager', () => {
  beforeAll(() => {
    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.VAULT_ENABLED = 'false';
    process.env.AWS_SECRETS_ENABLED = 'false';
  });

  afterAll(async () => {
    await secretsManager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize with environment variables when no provider is enabled', async () => {
      const result = await secretsManager.initialize();
      expect(result).toBe(true);
      expect(secretsManager.isReady()).toBe(true);
    });

    it('should handle initialization without throwing errors', async () => {
      await expect(secretsManager.initialize()).resolves.toBeDefined();
    });
  });

  describe('Environment Variable Fallback', () => {
    it('should get secret from environment variables', async () => {
      process.env.JWT_SECRET = 'test-jwt-secret-123';
      process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-456';
      
      const secret = await secretsManager.getSecret('cryptons/jwt', 'secret');
      expect(secret).toBe('test-jwt-secret-123');
    });

    it('should get all JWT secrets', async () => {
      process.env.JWT_SECRET = 'test-jwt-secret-123';
      process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-456';
      
      const secrets = await secretsManager.getSecret('cryptons/jwt');
      expect(secrets).toHaveProperty('secret');
      expect(secrets).toHaveProperty('refresh_secret');
      expect(secrets.secret).toBe('test-jwt-secret-123');
      expect(secrets.refresh_secret).toBe('test-refresh-secret-456');
    });

    it('should get database secrets from environment', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      
      const secrets = await secretsManager.getSecret('cryptons/database');
      expect(secrets).toHaveProperty('host');
      expect(secrets.host).toBe('mongodb://localhost:27017/test');
    });

    it('should get email secrets from environment', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'test@test.com';
      
      const secrets = await secretsManager.getSecret('cryptons/email');
      expect(secrets).toHaveProperty('smtp_host');
      expect(secrets.smtp_host).toBe('smtp.test.com');
    });

    it('should get encryption secrets from environment', async () => {
      process.env.FIELD_ENCRYPTION_KEY = 'abcd1234';
      process.env.WEBHOOK_SECRET = 'webhook-secret';
      
      const secrets = await secretsManager.getSecret('cryptons/encryption');
      expect(secrets).toHaveProperty('field_key');
      expect(secrets).toHaveProperty('webhook_secret');
    });
  });

  describe('Secret Caching', () => {
    beforeEach(() => {
      secretsManager.clearCache();
    });

    it('should cache secrets', async () => {
      process.env.TEST_SECRET = 'cached-value';
      
      const secret1 = await secretsManager.getSecret('cryptons/jwt', 'secret');
      const secret2 = await secretsManager.getSecret('cryptons/jwt', 'secret');
      
      // Both should return the same value
      expect(secret1).toBe(secret2);
    });

    it('should clear cache', () => {
      secretsManager.clearCache();
      // Should not throw error
      expect(secretsManager.secretsCache.size).toBe(0);
    });
  });

  describe('getAllSecrets', () => {
    beforeAll(() => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'jwt-secret';
      process.env.JWT_REFRESH_SECRET = 'refresh-secret';
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.BTC_ADDRESS = 'btc123';
      process.env.FIELD_ENCRYPTION_KEY = 'encryption-key';
    });

    it('should get all application secrets', async () => {
      const secrets = await secretsManager.getAllSecrets();
      
      expect(secrets).toHaveProperty('database');
      expect(secrets).toHaveProperty('jwt');
      expect(secrets).toHaveProperty('email');
      expect(secrets).toHaveProperty('blockchain');
      expect(secrets).toHaveProperty('encryption');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing secrets gracefully', async () => {
      delete process.env.NONEXISTENT_SECRET;
      
      const secret = await secretsManager.getSecret('nonexistent/path', 'key');
      expect(secret).toBeUndefined();
    });

    it('should not throw when getting undefined secrets', async () => {
      await expect(secretsManager.getSecret('undefined/path')).resolves.not.toThrow();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(secretsManager.shutdown()).resolves.not.toThrow();
    });
  });
});
