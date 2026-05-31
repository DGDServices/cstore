const logger = require('../src/utils/logger');

/**
 * Security Configuration
 * Central configuration for all security features
 */

/**
 * Get JWT configuration
 */
const getJwtConfig = () => {
  return {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenExpiry: process.env.JWT_EXPIRE || '7d',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRE || '30d',
    algorithm: 'HS256',
    issuer: 'cryptons.com',
    audience: 'cryptons-users'
  };
};

/**
 * Get Redis configuration for token revocation
 */
const getRedisConfig = () => {
  return {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    blacklistTtl: parseInt(process.env.JWT_BLACKLIST_TTL || 86400),
    maxRetries: 10,
    retryStrategy: (times) => Math.min(times * 100, 3000)
  };
};

/**
 * Get webhook security configuration
 */
const getWebhookConfig = () => {
  return {
    secret: process.env.WEBHOOK_SECRET,
    tolerance: parseInt(process.env.WEBHOOK_TOLERANCE || 300), // 5 minutes
    skipVerification: process.env.SKIP_WEBHOOK_VERIFICATION === 'true',
    algorithm: 'sha256'
  };
};

/**
 * Get HTTPS/TLS configuration
 */
const getHttpsConfig = () => {
  return {
    forceHttps: process.env.FORCE_HTTPS === 'true',
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || 31536000), // 1 year
    hstsIncludeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
    hstsPreload: process.env.HSTS_PRELOAD === 'true'
  };
};

/**
 * Get CORS configuration
 */
const getCorsConfig = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  return {
    origins: allowedOrigins,
    credentials: process.env.CORS_CREDENTIALS === 'true',
    maxAge: parseInt(process.env.CORS_MAX_AGE || 86400),
    blockNoOrigin: process.env.CORS_BLOCK_NO_ORIGIN === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  };
};

/**
 * Get encryption configuration
 */
const getEncryptionConfig = () => {
  return {
    // Field-level encryption
    fieldEncryption: {
      enabled: process.env.ENABLE_FIELD_ENCRYPTION === 'true',
      key: process.env.FIELD_ENCRYPTION_KEY,
      algorithm: 'aes-256-gcm'
    },
    
    // Database encryption at rest
    databaseEncryption: {
      enabled: process.env.MONGODB_ENCRYPTION_ENABLED === 'true',
      keyFile: process.env.MONGODB_ENCRYPTION_KEY_FILE,
      cipher: process.env.MONGODB_ENCRYPTION_CIPHER || 'AES256-GCM'
    }
  };
};

/**
 * Get secrets management configuration
 */
const getSecretsConfig = () => {
  return {
    provider: process.env.SECRETS_PROVIDER || 'env',
    
    // Vault configuration
    vault: {
      enabled: process.env.VAULT_ENABLED === 'true',
      url: process.env.VAULT_ADDR || process.env.VAULT_URL,
      roleId: process.env.VAULT_ROLE_ID,
      secretId: process.env.VAULT_SECRET_ID,
      token: process.env.VAULT_TOKEN
    },
    
    // AWS Secrets Manager configuration
    aws: {
      enabled: process.env.AWS_SECRETS_ENABLED === 'true',
      region: process.env.AWS_SECRETS_REGION || 'us-east-1'
    },
    
    // Cache configuration
    cacheTtl: parseInt(process.env.SECRETS_CACHE_TTL || 3600)
  };
};

/**
 * Get rate limiting configuration
 */
const getRateLimitConfig = () => {
  return {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || 100),
    
    // Stricter limits for auth endpoints
    auth: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || 5)
    },
    
    // Stricter limits for multi-sig operations
    multiSig: {
      windowMs: 60 * 60 * 1000,
      max: 10
    }
  };
};

/**
 * Get security headers configuration
 */
const getSecurityHeadersConfig = () => {
  return {
    contentSecurityPolicy: process.env.HELMET_CSP_ENABLED !== 'false',
    hsts: getHttpsConfig(),
    noSniff: true,
    xssFilter: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  };
};

/**
 * Validate security configuration
 * @returns {Object} Validation result with errors and warnings
 */
const validateSecurityConfig = () => {
  const errors = [];
  const warnings = [];

  // JWT validation
  const jwtConfig = getJwtConfig();
  if (!jwtConfig.secret || jwtConfig.secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }
  if (!jwtConfig.refreshSecret || jwtConfig.refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters');
  }

  // Redis validation
  const redisConfig = getRedisConfig();
  if (!redisConfig.enabled && process.env.NODE_ENV === 'production') {
    warnings.push('Redis token revocation is not enabled in production');
  }

  // Webhook validation
  const webhookConfig = getWebhookConfig();
  if (!webhookConfig.secret && process.env.NODE_ENV === 'production') {
    warnings.push('WEBHOOK_SECRET is not set in production');
  }
  if (webhookConfig.skipVerification && process.env.NODE_ENV === 'production') {
    errors.push('Webhook verification cannot be skipped in production');
  }

  // HTTPS validation
  const httpsConfig = getHttpsConfig();
  if (!httpsConfig.forceHttps && process.env.NODE_ENV === 'production') {
    warnings.push('HTTPS is not enforced in production');
  }

  // CORS validation
  const corsConfig = getCorsConfig();
  if (process.env.NODE_ENV === 'production') {
    const hasLocalhost = corsConfig.origins.some(o => o.includes('localhost'));
    if (hasLocalhost) {
      warnings.push('CORS allows localhost origins in production');
    }
  }

  // Encryption validation
  const encryptionConfig = getEncryptionConfig();
  if (!encryptionConfig.fieldEncryption.enabled && process.env.NODE_ENV === 'production') {
    warnings.push('Field-level encryption is not enabled in production');
  }
  if (encryptionConfig.fieldEncryption.enabled && !encryptionConfig.fieldEncryption.key) {
    errors.push('FIELD_ENCRYPTION_KEY must be set when encryption is enabled');
  }

  // Secrets management validation
  const secretsConfig = getSecretsConfig();
  if (process.env.NODE_ENV === 'production' && 
      !secretsConfig.vault.enabled && 
      !secretsConfig.aws.enabled) {
    warnings.push('No secrets management system (Vault/AWS) is enabled in production');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    environment: process.env.NODE_ENV || 'development'
  };
};

/**
 * Initialize and validate all security configurations
 */
const initializeSecurityConfig = () => {
  const validation = validateSecurityConfig();
  
  // Log validation results
  if (!validation.valid) {
    logger.error('Security configuration validation failed:', {
      errors: validation.errors,
      environment: validation.environment
    });
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid security configuration in production. Check logs for details.');
    }
  }

  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warning => {
      logger.warn(`Security warning: ${warning}`);
    });
  }

  // Log active security features
  const features = {
    jwtRevocation: getRedisConfig().enabled,
    webhookVerification: !!getWebhookConfig().secret,
    httpsEnforcement: getHttpsConfig().forceHttps,
    fieldEncryption: getEncryptionConfig().fieldEncryption.enabled,
    databaseEncryption: getEncryptionConfig().databaseEncryption.enabled,
    secretsManagement: getSecretsConfig().vault.enabled || getSecretsConfig().aws.enabled
  };

  logger.info('Security configuration initialized:', {
    environment: validation.environment,
    features,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length
  });

  return validation;
};

/**
 * Get complete security configuration
 */
const getSecurityConfig = () => {
  return {
    jwt: getJwtConfig(),
    redis: getRedisConfig(),
    webhook: getWebhookConfig(),
    https: getHttpsConfig(),
    cors: getCorsConfig(),
    encryption: getEncryptionConfig(),
    secrets: getSecretsConfig(),
    rateLimit: getRateLimitConfig(),
    headers: getSecurityHeadersConfig()
  };
};

module.exports = {
  getJwtConfig,
  getRedisConfig,
  getWebhookConfig,
  getHttpsConfig,
  getCorsConfig,
  getEncryptionConfig,
  getSecretsConfig,
  getRateLimitConfig,
  getSecurityHeadersConfig,
  validateSecurityConfig,
  initializeSecurityConfig,
  getSecurityConfig
};
