const logger = require('./logger');

/**
 * Critical secrets that must be set in production
 */
const CRITICAL_SECRETS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MONGODB_URI'
];

/**
 * Recommended secrets for production
 */
const RECOMMENDED_SECRETS = [
  'WEBHOOK_SECRET',
  'FIELD_ENCRYPTION_KEY',
  'REDIS_PASSWORD',
  'SMTP_PASSWORD'
];

/**
 * Default values that should NOT be used in production
 */
const INSECURE_DEFAULTS = [
  'your-secret-key-change-in-production',
  'your-super-secret-jwt-key-change-in-production',
  'your-refresh-secret-key-change-in-production',
  'change-in-production',
  'default',
  'secret',
  'password',
  '12345'
];

/**
 * Validate that a secret meets minimum security requirements
 * @param {string} secret - Secret to validate
 * @returns {Object} - { valid: boolean, reason: string }
 */
const validateSecretStrength = (secret) => {
  if (!secret) {
    return { valid: false, reason: 'Secret is empty or undefined' };
  }

  // Check length
  if (secret.length < 32) {
    return { valid: false, reason: 'Secret is too short (minimum 32 characters)' };
  }

  // Check for insecure defaults
  if (INSECURE_DEFAULTS.some(def => secret.toLowerCase().includes(def.toLowerCase()))) {
    return { valid: false, reason: 'Secret contains insecure default value' };
  }

  // Check entropy (simple check for repeated characters)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 10) {
    return { valid: false, reason: 'Secret has low entropy (too few unique characters)' };
  }

  return { valid: true, reason: 'Secret meets requirements' };
};

/**
 * Validate all critical secrets
 * @returns {Object} - Validation results
 */
const validateSecrets = () => {
  const env = process.env.NODE_ENV || 'development';
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    environment: env
  };

  // Skip validation in development/test
  if (env === 'development' || env === 'test') {
    logger.info('Secrets validation skipped (not in production)');
    return results;
  }

  // Validate critical secrets
  CRITICAL_SECRETS.forEach(secret => {
    const value = process.env[secret];
    
    if (!value) {
      results.valid = false;
      results.errors.push(`❌ ${secret} is not set`);
    } else {
      const validation = validateSecretStrength(value);
      if (!validation.valid) {
        results.valid = false;
        results.errors.push(`❌ ${secret}: ${validation.reason}`);
      }
    }
  });

  // Validate recommended secrets (warnings only)
  RECOMMENDED_SECRETS.forEach(secret => {
    const value = process.env[secret];
    
    if (!value) {
      results.warnings.push(`⚠️  ${secret} is not set (recommended for production)`);
    } else {
      const validation = validateSecretStrength(value);
      if (!validation.valid) {
        results.warnings.push(`⚠️  ${secret}: ${validation.reason}`);
      }
    }
  });

  return results;
};

/**
 * Validate secrets and log results
 * Throws error in production if critical secrets are invalid
 */
const validateAndLogSecrets = () => {
  const results = validateSecrets();

  if (results.errors.length > 0) {
    logger.error('🔴 CRITICAL: Invalid secrets configuration');
    results.errors.forEach(error => logger.error(error));
  }

  if (results.warnings.length > 0) {
    logger.warn('⚠️  Secrets configuration warnings:');
    results.warnings.forEach(warning => logger.warn(warning));
  }

  if (results.errors.length === 0 && results.warnings.length === 0) {
    logger.info('✅ Secrets validation passed');
  }

  // Throw error in production if critical validation fails
  if (!results.valid && process.env.NODE_ENV === 'production') {
    throw new Error('Critical secrets validation failed. Check logs for details.');
  }

  return results;
};

/**
 * Check if MongoDB URI is using authentication
 * @returns {boolean}
 */
const isMongoAuthEnabled = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  
  // Check if URI contains username:password
  return uri.includes('@') && uri.includes('://');
};

/**
 * Check if MongoDB URI is using TLS
 * @returns {boolean}
 */
const isMongoTLSEnabled = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  
  return uri.includes('tls=true') || uri.includes('ssl=true');
};

/**
 * Get security configuration summary
 * @returns {Object} - Security configuration status
 */
const getSecuritySummary = () => {
  const env = process.env.NODE_ENV || 'development';
  
  return {
    environment: env,
    jwtConfigured: !!process.env.JWT_SECRET,
    webhookSecurityEnabled: !!process.env.WEBHOOK_SECRET,
    redisEnabled: process.env.REDIS_ENABLED === 'true',
    encryptionEnabled: !!process.env.FIELD_ENCRYPTION_KEY,
    mongoAuth: isMongoAuthEnabled(),
    mongoTLS: isMongoTLSEnabled(),
    corsConfigured: !!process.env.ALLOWED_ORIGINS,
    productionReady: env === 'production' && validateSecrets().valid
  };
};

module.exports = {
  validateSecrets,
  validateAndLogSecrets,
  validateSecretStrength,
  isMongoAuthEnabled,
  isMongoTLSEnabled,
  getSecuritySummary
};
