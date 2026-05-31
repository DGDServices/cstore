const {
  getJwtConfig,
  getRedisConfig,
  getWebhookConfig,
  getHttpsConfig,
  getCorsConfig,
  getEncryptionConfig,
  getSecretsConfig,
  getRateLimitConfig,
  validateSecurityConfig,
  getSecurityConfig
} = require('../config/security');

describe('Security Configuration', () => {
  beforeEach(() => {
    // Set up clean environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.REDIS_ENABLED;
    delete process.env.WEBHOOK_SECRET;
    delete process.env.WEBHOOK_TOLERANCE;
    delete process.env.FORCE_HTTPS;
    delete process.env.HSTS_MAX_AGE;
    delete process.env.HSTS_PRELOAD;
    delete process.env.HSTS_INCLUDE_SUBDOMAINS;
    delete process.env.ALLOWED_ORIGINS;
  });

  describe('getJwtConfig', () => {
    it('should return JWT configuration', () => {
      const config = getJwtConfig();

      expect(config).toHaveProperty('secret');
      expect(config).toHaveProperty('refreshSecret');
      expect(config).toHaveProperty('accessTokenExpiry');
      expect(config).toHaveProperty('algorithm');
      expect(config.algorithm).toBe('HS256');
    });

    it('should use environment variables', () => {
      process.env.JWT_EXPIRE = '24h';
      process.env.JWT_REFRESH_EXPIRE = '60d';

      const config = getJwtConfig();

      expect(config.accessTokenExpiry).toBe('24h');
      expect(config.refreshTokenExpiry).toBe('60d');
    });
  });

  describe('getRedisConfig', () => {
    it('should return Redis configuration', () => {
      process.env.REDIS_ENABLED = 'true';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const config = getRedisConfig();

      expect(config.enabled).toBe(true);
      expect(config.url).toBe('redis://localhost:6379');
      expect(config).toHaveProperty('blacklistTtl');
      expect(config).toHaveProperty('maxRetries');
    });

    it('should return disabled config when not enabled', () => {
      process.env.REDIS_ENABLED = 'false';

      const config = getRedisConfig();

      expect(config.enabled).toBe(false);
    });
  });

  describe('getWebhookConfig', () => {
    it('should return webhook configuration', () => {
      process.env.WEBHOOK_SECRET = 'webhook-secret-key';
      process.env.WEBHOOK_TOLERANCE = '600';

      const config = getWebhookConfig();

      expect(config.secret).toBe('webhook-secret-key');
      expect(config.tolerance).toBe(600);
      expect(config.algorithm).toBe('sha256');
    });

    it('should use default tolerance', () => {
      const config = getWebhookConfig();

      expect(config.tolerance).toBe(300); // 5 minutes default
    });
  });

  describe('getHttpsConfig', () => {
    it('should return HTTPS configuration', () => {
      process.env.FORCE_HTTPS = 'true';
      process.env.HSTS_MAX_AGE = '7200';

      const config = getHttpsConfig();

      expect(config.forceHttps).toBe(true);
      expect(config.hstsMaxAge).toBe(7200);
    });

    it('should use defaults for HSTS', () => {
      const config = getHttpsConfig();

      expect(config.hstsMaxAge).toBe(31536000); // 1 year
      expect(config.hstsIncludeSubDomains).toBe(true);
      expect(config.hstsPreload).toBe(false);
    });
  });

  describe('getCorsConfig', () => {
    it('should parse CORS origins from environment', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://www.example.com';

      const config = getCorsConfig();

      expect(config.origins).toContain('https://example.com');
      expect(config.origins).toContain('https://www.example.com');
      expect(config.origins).toHaveLength(2);
    });

    it('should use default origins when not specified', () => {
      const config = getCorsConfig();

      expect(config.origins).toContain('http://localhost:3000');
      expect(config.origins).toContain('http://localhost:3001');
    });

    it('should include credentials configuration', () => {
      process.env.CORS_CREDENTIALS = 'true';

      const config = getCorsConfig();

      expect(config.credentials).toBe(true);
    });
  });

  describe('getEncryptionConfig', () => {
    it('should return encryption configuration', () => {
      process.env.ENABLE_FIELD_ENCRYPTION = 'true';
      process.env.FIELD_ENCRYPTION_KEY = 'abcd1234';

      const config = getEncryptionConfig();

      expect(config.fieldEncryption.enabled).toBe(true);
      expect(config.fieldEncryption.key).toBe('abcd1234');
      expect(config.fieldEncryption.algorithm).toBe('aes-256-gcm');
    });

    it('should return database encryption config', () => {
      process.env.MONGODB_ENCRYPTION_ENABLED = 'true';
      process.env.MONGODB_ENCRYPTION_CIPHER = 'AES256-CBC';

      const config = getEncryptionConfig();

      expect(config.databaseEncryption.enabled).toBe(true);
      expect(config.databaseEncryption.cipher).toBe('AES256-CBC');
    });
  });

  describe('getSecretsConfig', () => {
    it('should return Vault configuration', () => {
      process.env.VAULT_ENABLED = 'true';
      process.env.VAULT_URL = 'https://vault.example.com';

      const config = getSecretsConfig();

      expect(config.vault.enabled).toBe(true);
      expect(config.vault.url).toBe('https://vault.example.com');
    });

    it('should return AWS configuration', () => {
      process.env.AWS_SECRETS_ENABLED = 'true';
      process.env.AWS_SECRETS_REGION = 'us-west-2';

      const config = getSecretsConfig();

      expect(config.aws.enabled).toBe(true);
      expect(config.aws.region).toBe('us-west-2');
    });

    it('should default to env provider', () => {
      const config = getSecretsConfig();

      expect(config.provider).toBe('env');
    });
  });

  describe('getRateLimitConfig', () => {
    it('should return rate limit configuration', () => {
      process.env.RATE_LIMIT_WINDOW = '10';
      process.env.RATE_LIMIT_MAX = '50';

      const config = getRateLimitConfig();

      expect(config.windowMs).toBe(600000); // 10 minutes in ms
      expect(config.max).toBe(50);
    });

    it('should include auth-specific limits', () => {
      const config = getRateLimitConfig();

      expect(config.auth).toBeDefined();
      expect(config.auth.windowMs).toBe(900000); // 15 minutes
      expect(config.auth.max).toBeDefined();
    });
  });

  describe('validateSecurityConfig', () => {
    it('should validate JWT secrets', () => {
      process.env.JWT_SECRET = 'short';
      process.env.JWT_REFRESH_SECRET = 'also-short';

      const validation = validateSecurityConfig();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('JWT_SECRET must be at least 32 characters');
      expect(validation.errors).toContain('JWT_REFRESH_SECRET must be at least 32 characters');
    });

    it('should pass validation with proper secrets', () => {
      process.env.JWT_SECRET = 'this-is-a-very-long-secret-key-that-is-at-least-32-chars';
      process.env.JWT_REFRESH_SECRET = 'this-is-another-long-secret-key-at-least-32-chars';

      const validation = validateSecurityConfig();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should warn about missing Redis in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_ENABLED = 'false';

      const validation = validateSecurityConfig();

      expect(validation.warnings).toContain('Redis token revocation is not enabled in production');
    });

    it('should warn about missing webhook secret in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.WEBHOOK_SECRET;

      const validation = validateSecurityConfig();

      expect(validation.warnings).toContain('WEBHOOK_SECRET is not set in production');
    });

    it('should error on webhook verification skip in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.SKIP_WEBHOOK_VERIFICATION = 'true';

      const validation = validateSecurityConfig();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Webhook verification cannot be skipped in production');
    });

    it('should warn about missing HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'false';

      const validation = validateSecurityConfig();

      expect(validation.warnings).toContain('HTTPS is not enforced in production');
    });

    it('should warn about localhost in production CORS', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';

      const validation = validateSecurityConfig();

      expect(validation.warnings).toContain('CORS allows localhost origins in production');
    });

    it('should warn about missing field encryption in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_FIELD_ENCRYPTION = 'false';

      const validation = validateSecurityConfig();

      expect(validation.warnings).toContain('Field-level encryption is not enabled in production');
    });

    it('should error on missing encryption key when enabled', () => {
      process.env.ENABLE_FIELD_ENCRYPTION = 'true';
      delete process.env.FIELD_ENCRYPTION_KEY;

      const validation = validateSecurityConfig();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('FIELD_ENCRYPTION_KEY must be set when encryption is enabled');
    });
  });

  describe('getSecurityConfig', () => {
    it('should return complete security configuration', () => {
      const config = getSecurityConfig();

      expect(config).toHaveProperty('jwt');
      expect(config).toHaveProperty('redis');
      expect(config).toHaveProperty('webhook');
      expect(config).toHaveProperty('https');
      expect(config).toHaveProperty('cors');
      expect(config).toHaveProperty('encryption');
      expect(config).toHaveProperty('secrets');
      expect(config).toHaveProperty('rateLimit');
      expect(config).toHaveProperty('headers');
    });
  });
});
