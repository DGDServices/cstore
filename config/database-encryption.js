const logger = require('../src/utils/logger');

/**
 * MongoDB Encryption at Rest Configuration
 * 
 * This configuration is for MongoDB Enterprise Edition's native encryption at rest.
 * For MongoDB Community Edition, use field-level encryption utilities instead.
 */

/**
 * Get MongoDB encryption configuration
 * @returns {Object} Encryption configuration for MongoDB
 */
const getMongoDBEncryptionConfig = () => {
  const config = {
    // Enable encryption at rest (requires MongoDB Enterprise)
    encryptionEnabled: process.env.MONGODB_ENCRYPTION_ENABLED === 'true',
    
    // Encryption key file path (must be 32 bytes)
    encryptionKeyFile: process.env.MONGODB_ENCRYPTION_KEY_FILE || '/etc/mongodb/mongodb-keyfile',
    
    // Cipher mode: AES256-CBC or AES256-GCM
    encryptionCipherMode: process.env.MONGODB_ENCRYPTION_CIPHER || 'AES256-GCM',
    
    // TLS/SSL configuration for connections
    tls: {
      enabled: process.env.MONGODB_TLS_ENABLED === 'true',
      caFile: process.env.MONGODB_TLS_CA_FILE,
      certificateKeyFile: process.env.MONGODB_TLS_CERT_FILE,
      allowInvalidCertificates: process.env.NODE_ENV === 'development'
    }
  };

  return config;
};

/**
 * Generate MongoDB configuration file content for encryption at rest
 * This generates the YAML configuration for mongod.conf
 * @returns {string} YAML configuration
 */
const generateMongodConfig = () => {
  const config = getMongoDBEncryptionConfig();
  
  if (!config.encryptionEnabled) {
    return '# Encryption at rest is disabled';
  }

  return `
# MongoDB Security Configuration
security:
  enableEncryption: true
  encryptionKeyFile: ${config.encryptionKeyFile}
  encryptionCipherMode: ${config.encryptionCipherMode}

# TLS/SSL Configuration
net:
  tls:
    mode: ${config.tls.enabled ? 'requireTLS' : 'disabled'}
    certificateKeyFile: ${config.tls.certificateKeyFile || '/etc/mongodb/mongodb.pem'}
    CAFile: ${config.tls.caFile || '/etc/mongodb/ca.pem'}
    allowConnectionsWithoutCertificates: false
    allowInvalidCertificates: ${config.tls.allowInvalidCertificates}

# Storage Engine Options
storage:
  engine: wiredTiger
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1
    collectionConfig:
      blockCompressor: snappy
`;
};

/**
 * MongoDB Atlas encryption configuration
 * Atlas provides automatic encryption at rest
 */
const getAtlasEncryptionConfig = () => {
  return {
    provider: 'atlas',
    automaticEncryption: true,
    encryptionAtRest: {
      cloudProvider: process.env.ATLAS_CLOUD_PROVIDER || 'AWS',
      region: process.env.ATLAS_REGION || 'us-east-1',
      kmsProvider: {
        aws: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      }
    }
  };
};

/**
 * Field-level encryption configuration
 * For encrypting specific sensitive fields in documents
 */
const getFieldEncryptionConfig = () => {
  return {
    enabled: process.env.ENABLE_FIELD_ENCRYPTION === 'true',
    
    // Fields to encrypt in User model
    userFields: ['email', 'firstName', 'lastName', 'phone'],
    
    // Fields to encrypt in Order model  
    orderFields: ['shippingAddress', 'billingAddress'],
    
    // Fields to encrypt in Payment model
    paymentFields: ['cardLastFour', 'billingAddress'],
    
    // Master encryption key (should be 32 bytes / 64 hex chars)
    masterKey: process.env.FIELD_ENCRYPTION_KEY,
    
    // Algorithm to use
    algorithm: 'aes-256-gcm',
    
    // Automatically encrypt/decrypt on save/read
    autoEncrypt: true,
    
    // Key derivation iterations
    keyDerivationIterations: 100000
  };
};

/**
 * Validate encryption configuration
 * @returns {Object} Validation result
 */
const validateEncryptionConfig = () => {
  const errors = [];
  const warnings = [];

  // Check MongoDB encryption
  if (process.env.MONGODB_ENCRYPTION_ENABLED === 'true') {
    if (!process.env.MONGODB_ENCRYPTION_KEY_FILE) {
      errors.push('MONGODB_ENCRYPTION_KEY_FILE must be set when encryption is enabled');
    }
    
    if (process.env.NODE_ENV === 'production') {
      logger.info('MongoDB encryption at rest is enabled (Enterprise Edition required)');
    }
  } else if (process.env.NODE_ENV === 'production') {
    warnings.push('MongoDB encryption at rest is not enabled in production');
  }

  // Check field-level encryption
  if (process.env.ENABLE_FIELD_ENCRYPTION === 'true') {
    if (!process.env.FIELD_ENCRYPTION_KEY) {
      errors.push('FIELD_ENCRYPTION_KEY must be set when field encryption is enabled');
    } else if (process.env.FIELD_ENCRYPTION_KEY.length !== 64) {
      errors.push('FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    
    logger.info('Field-level encryption is enabled for sensitive data');
  } else if (process.env.NODE_ENV === 'production') {
    warnings.push('Field-level encryption is not enabled in production');
  }

  // Check TLS
  if (process.env.MONGODB_TLS_ENABLED !== 'true' && process.env.NODE_ENV === 'production') {
    warnings.push('MongoDB TLS is not enabled in production');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Initialize encryption configuration
 * Validates and logs the current encryption setup
 */
const initializeEncryptionConfig = () => {
  const validation = validateEncryptionConfig();
  
  if (!validation.valid) {
    logger.error('Encryption configuration validation failed:', validation.errors);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid encryption configuration in production');
    }
  }

  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warning => {
      logger.warn(`Encryption warning: ${warning}`);
    });
  }

  const mongoConfig = getMongoDBEncryptionConfig();
  const fieldConfig = getFieldEncryptionConfig();

  logger.info('Database encryption configuration initialized:', {
    mongodbEncryption: mongoConfig.encryptionEnabled,
    fieldEncryption: fieldConfig.enabled,
    tlsEnabled: mongoConfig.tls.enabled
  });

  return {
    mongodb: mongoConfig,
    fields: fieldConfig,
    validation
  };
};

/**
 * Get connection string with TLS options
 * @param {string} baseUri - Base MongoDB connection URI
 * @returns {string} Connection string with TLS options
 */
const getSecureConnectionString = (baseUri) => {
  const config = getMongoDBEncryptionConfig();
  
  if (!config.tls.enabled) {
    return baseUri;
  }

  // Add TLS parameters to connection string
  const separator = baseUri.includes('?') ? '&' : '?';
  const tlsParams = [
    'tls=true',
    `tlsCAFile=${config.tls.caFile}`,
    `tlsCertificateKeyFile=${config.tls.certificateKeyFile}`,
    config.tls.allowInvalidCertificates ? 'tlsAllowInvalidCertificates=true' : ''
  ].filter(Boolean).join('&');

  return `${baseUri}${separator}${tlsParams}`;
};

module.exports = {
  getMongoDBEncryptionConfig,
  generateMongodConfig,
  getAtlasEncryptionConfig,
  getFieldEncryptionConfig,
  validateEncryptionConfig,
  initializeEncryptionConfig,
  getSecureConnectionString
};
