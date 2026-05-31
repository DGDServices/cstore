const {
  getMongoDBEncryptionConfig,
  generateMongodConfig,
  getFieldEncryptionConfig,
  validateEncryptionConfig,
  getSecureConnectionString
} = require('../config/database-encryption');

describe('Database Encryption Configuration', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.MONGODB_ENCRYPTION_ENABLED;
    delete process.env.MONGODB_ENCRYPTION_KEY_FILE;
    delete process.env.MONGODB_ENCRYPTION_CIPHER;
    delete process.env.MONGODB_TLS_ENABLED;
    delete process.env.ENABLE_FIELD_ENCRYPTION;
    delete process.env.FIELD_ENCRYPTION_KEY;
  });

  describe('getMongoDBEncryptionConfig', () => {
    it('should return disabled encryption config by default', () => {
      const config = getMongoDBEncryptionConfig();

      expect(config.encryptionEnabled).toBe(false);
    });

    it('should return enabled encryption config when set', () => {
      process.env.MONGODB_ENCRYPTION_ENABLED = 'true';
      process.env.MONGODB_ENCRYPTION_KEY_FILE = '/path/to/keyfile';

      const config = getMongoDBEncryptionConfig();

      expect(config.encryptionEnabled).toBe(true);
      expect(config.encryptionKeyFile).toBe('/path/to/keyfile');
    });

    it('should use default cipher mode', () => {
      const config = getMongoDBEncryptionConfig();

      expect(config.encryptionCipherMode).toBe('AES256-GCM');
    });

    it('should use custom cipher mode', () => {
      process.env.MONGODB_ENCRYPTION_CIPHER = 'AES256-CBC';

      const config = getMongoDBEncryptionConfig();

      expect(config.encryptionCipherMode).toBe('AES256-CBC');
    });

    it('should return TLS configuration', () => {
      process.env.MONGODB_TLS_ENABLED = 'true';
      process.env.MONGODB_TLS_CA_FILE = '/path/to/ca.pem';

      const config = getMongoDBEncryptionConfig();

      expect(config.tls.enabled).toBe(true);
      expect(config.tls.caFile).toBe('/path/to/ca.pem');
    });

    it('should allow invalid certificates in development', () => {
      process.env.NODE_ENV = 'development';

      const config = getMongoDBEncryptionConfig();

      expect(config.tls.allowInvalidCertificates).toBe(true);
    });
  });

  describe('generateMongodConfig', () => {
    it('should return disabled message when encryption is off', () => {
      process.env.MONGODB_ENCRYPTION_ENABLED = 'false';

      const config = generateMongodConfig();

      expect(config).toContain('Encryption at rest is disabled');
    });

    it('should generate YAML config when encryption is enabled', () => {
      process.env.MONGODB_ENCRYPTION_ENABLED = 'true';
      process.env.MONGODB_ENCRYPTION_KEY_FILE = '/etc/mongodb/keyfile';

      const config = generateMongodConfig();

      expect(config).toContain('security:');
      expect(config).toContain('enableEncryption: true');
      expect(config).toContain('encryptionKeyFile: /etc/mongodb/keyfile');
    });

    it('should include TLS configuration in YAML', () => {
      process.env.MONGODB_ENCRYPTION_ENABLED = 'true';
      process.env.MONGODB_TLS_ENABLED = 'true';

      const config = generateMongodConfig();

      expect(config).toContain('net:');
      expect(config).toContain('tls:');
      expect(config).toContain('mode: requireTLS');
    });
  });

  describe('getFieldEncryptionConfig', () => {
    it('should return disabled field encryption by default', () => {
      const config = getFieldEncryptionConfig();

      expect(config.enabled).toBe(false);
    });

    it('should return enabled field encryption config', () => {
      process.env.ENABLE_FIELD_ENCRYPTION = 'true';
      process.env.FIELD_ENCRYPTION_KEY = 'abcd1234';

      const config = getFieldEncryptionConfig();

      expect(config.enabled).toBe(true);
      expect(config.masterKey).toBe('abcd1234');
      expect(config.algorithm).toBe('aes-256-gcm');
    });

    it('should define user fields to encrypt', () => {
      const config = getFieldEncryptionConfig();

      expect(config.userFields).toContain('email');
      expect(config.userFields).toContain('firstName');
      expect(config.userFields).toContain('lastName');
    });

    it('should define order fields to encrypt', () => {
      const config = getFieldEncryptionConfig();

      expect(config.orderFields).toContain('shippingAddress');
      expect(config.orderFields).toContain('billingAddress');
    });

    it('should have auto-encrypt enabled', () => {
      const config = getFieldEncryptionConfig();

      expect(config.autoEncrypt).toBe(true);
    });
  });

  describe('validateEncryptionConfig', () => {
    it('should validate successfully with minimal config in test', () => {
      process.env.NODE_ENV = 'test';

      const validation = validateEncryptionConfig();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should error on missing encryption key file when enabled', () => {
      process.env.MONGODB_ENCRYPTION_ENABLED = 'true';
      delete process.env.MONGODB_ENCRYPTION_KEY_FILE;

      const validation = validateEncryptionConfig();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('MONGODB_ENCRYPTION_KEY_FILE must be set when encryption is enabled');
    });

    it('should error on missing field encryption key when enabled', () => {
      process.env.ENABLE_FIELD_ENCRYPTION = 'true';
      delete process.env.FIELD_ENCRYPTION_KEY;

      const validation = validateEncryptionConfig();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('FIELD_ENCRYPTION_KEY must be set when field encryption is enabled');
    });

    it('should error on invalid field encryption key length', () => {
      process.env.ENABLE_FIELD_ENCRYPTION = 'true';
      process.env.FIELD_ENCRYPTION_KEY = 'short';

      const validation = validateEncryptionConfig();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    });

    it('should warn about missing encryption in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_ENCRYPTION_ENABLED = 'false';
      process.env.ENABLE_FIELD_ENCRYPTION = 'false';

      const validation = validateEncryptionConfig();

      expect(validation.warnings).toContain('MongoDB encryption at rest is not enabled in production');
      expect(validation.warnings).toContain('Field-level encryption is not enabled in production');
    });

    it('should warn about missing TLS in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_TLS_ENABLED = 'false';

      const validation = validateEncryptionConfig();

      expect(validation.warnings).toContain('MongoDB TLS is not enabled in production');
    });

    it('should accept valid field encryption key', () => {
      process.env.ENABLE_FIELD_ENCRYPTION = 'true';
      process.env.FIELD_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 chars

      const validation = validateEncryptionConfig();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('getSecureConnectionString', () => {
    it('should return base URI when TLS is disabled', () => {
      process.env.MONGODB_TLS_ENABLED = 'false';
      const baseUri = 'mongodb://localhost:27017/test';

      const secureUri = getSecureConnectionString(baseUri);

      expect(secureUri).toBe(baseUri);
    });

    it('should add TLS parameters when enabled', () => {
      process.env.MONGODB_TLS_ENABLED = 'true';
      process.env.MONGODB_TLS_CA_FILE = '/etc/ca.pem';
      process.env.MONGODB_TLS_CERT_FILE = '/etc/cert.pem';
      const baseUri = 'mongodb://localhost:27017/test';

      const secureUri = getSecureConnectionString(baseUri);

      expect(secureUri).toContain('tls=true');
      expect(secureUri).toContain('tlsCAFile=');
      expect(secureUri).toContain('tlsCertificateKeyFile=');
    });

    it('should handle existing query parameters', () => {
      process.env.MONGODB_TLS_ENABLED = 'true';
      process.env.MONGODB_TLS_CA_FILE = '/etc/ca.pem';
      const baseUri = 'mongodb://localhost:27017/test?authSource=admin';

      const secureUri = getSecureConnectionString(baseUri);

      expect(secureUri).toContain('?authSource=admin');
      expect(secureUri).toContain('&tls=true');
    });

    it('should include allowInvalidCertificates in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.MONGODB_TLS_ENABLED = 'true';
      process.env.MONGODB_TLS_CA_FILE = '/etc/ca.pem';
      const baseUri = 'mongodb://localhost:27017/test';

      const secureUri = getSecureConnectionString(baseUri);

      expect(secureUri).toContain('tlsAllowInvalidCertificates=true');
    });
  });
});
