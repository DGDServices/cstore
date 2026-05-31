const vault = require('node-vault');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const logger = require('../utils/logger');

/**
 * Secrets Manager Service
 * Provides unified interface for HashiCorp Vault and AWS Secrets Manager
 * with automatic fallback and caching
 */
class SecretsManager {
  constructor() {
    this.provider = process.env.SECRETS_PROVIDER || 'vault';
    this.vaultClient = null;
    this.awsClient = null;
    this.secretsCache = new Map();
    this.cacheExpiry = parseInt(process.env.SECRETS_CACHE_TTL || 3600) * 1000; // Default 1 hour
    this.tokenRenewalInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the secrets manager
   * @returns {Promise<boolean>} True if initialized successfully
   */
  async initialize() {
    try {
      // Check if secrets management is enabled
      if (process.env.VAULT_ENABLED !== 'true' && process.env.AWS_SECRETS_ENABLED !== 'true') {
        logger.info('Secrets management is disabled. Using environment variables.');
        this.isInitialized = true;
        return true;
      }

      if (this.provider === 'vault' && process.env.VAULT_ENABLED === 'true') {
        await this.initializeVault();
      } else if (this.provider === 'aws' && process.env.AWS_SECRETS_ENABLED === 'true') {
        await this.initializeAWS();
      } else {
        logger.warn('No secrets provider configured. Using environment variables.');
      }

      this.isInitialized = true;
      logger.info(`Secrets Manager initialized with provider: ${this.provider}`);
      return true;
    } catch (error) {
      logger.error('Failed to initialize Secrets Manager:', error);
      // Fail gracefully - fall back to environment variables
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Initialize HashiCorp Vault client
   */
  async initializeVault() {
    try {
      const vaultAddr = process.env.VAULT_ADDR || process.env.VAULT_URL || 'http://localhost:8200';
      
      this.vaultClient = vault({
        apiVersion: 'v1',
        endpoint: vaultAddr,
        requestOptions: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      });

      // Authenticate with AppRole
      if (process.env.VAULT_ROLE_ID && process.env.VAULT_SECRET_ID) {
        await this.authenticateVaultAppRole();
      } else if (process.env.VAULT_TOKEN) {
        this.vaultClient.token = process.env.VAULT_TOKEN;
      } else {
        throw new Error('No Vault authentication method configured');
      }

      // Start token renewal
      this.startVaultTokenRenewal();

      logger.info('Vault client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Vault client:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Vault using AppRole
   */
  async authenticateVaultAppRole() {
    try {
      const result = await this.vaultClient.approleLogin({
        role_id: process.env.VAULT_ROLE_ID,
        secret_id: process.env.VAULT_SECRET_ID
      });

      this.vaultClient.token = result.auth.client_token;
      logger.info('Vault AppRole authentication successful');
    } catch (error) {
      logger.error('Vault AppRole authentication failed:', error);
      throw error;
    }
  }

  /**
   * Start automatic Vault token renewal
   */
  startVaultTokenRenewal() {
    // Renew token every 50 minutes (tokens typically last 1 hour)
    const renewalInterval = 50 * 60 * 1000;

    this.tokenRenewalInterval = setInterval(async () => {
      try {
        await this.vaultClient.tokenRenewSelf();
        logger.info('Vault token renewed successfully');
      } catch (error) {
        logger.error('Failed to renew Vault token:', error);
        // Try to re-authenticate
        if (process.env.VAULT_ROLE_ID && process.env.VAULT_SECRET_ID) {
          await this.authenticateVaultAppRole();
        }
      }
    }, renewalInterval);
  }

  /**
   * Initialize AWS Secrets Manager client
   */
  async initializeAWS() {
    try {
      this.awsClient = new SecretsManagerClient({
        region: process.env.AWS_SECRETS_REGION || 'us-east-1'
      });

      logger.info('AWS Secrets Manager client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AWS Secrets Manager:', error);
      throw error;
    }
  }

  /**
   * Get a secret from the configured provider
   * @param {string} path - Secret path/name
   * @param {string} key - Optional key within the secret
   * @returns {Promise<any>} Secret value
   */
  async getSecret(path, key = null) {
    try {
      // Check cache first
      const cacheKey = `${path}:${key || 'all'}`;
      const cached = this.getCachedSecret(cacheKey);
      if (cached !== null) {
        return cached;
      }

      let secretValue;

      // Try primary provider
      if (this.vaultClient) {
        secretValue = await this.getVaultSecret(path, key);
      } else if (this.awsClient) {
        secretValue = await this.getAWSSecret(path, key);
      } else {
        // Fallback to environment variable
        secretValue = this.getEnvSecret(path, key);
      }

      // Cache the secret
      this.cacheSecret(cacheKey, secretValue);

      return secretValue;
    } catch (error) {
      logger.error(`Failed to get secret ${path}:`, error);
      // Fallback to environment variable
      return this.getEnvSecret(path, key);
    }
  }

  /**
   * Get secret from Vault
   */
  async getVaultSecret(path, key) {
    try {
      const result = await this.vaultClient.read(`secret/data/${path}`);
      const data = result.data.data;

      if (key) {
        return data[key];
      }

      return data;
    } catch (error) {
      logger.error(`Failed to read from Vault: ${path}`, error);
      throw error;
    }
  }

  /**
   * Get secret from AWS Secrets Manager
   */
  async getAWSSecret(path, key) {
    try {
      const command = new GetSecretValueCommand({
        SecretId: path
      });

      const response = await this.awsClient.send(command);
      const secretString = response.SecretString;
      const data = JSON.parse(secretString);

      if (key) {
        return data[key];
      }

      return data;
    } catch (error) {
      logger.error(`Failed to read from AWS Secrets Manager: ${path}`, error);
      throw error;
    }
  }

  /**
   * Get secret from environment variables (fallback)
   */
  getEnvSecret(path, key) {
    // Convert path to environment variable name
    // e.g., 'cryptons/database' -> 'CRYPTONS_DATABASE' or specific keys
    const envVarMap = {
      'cryptons/database': {
        host: 'MONGODB_URI',
        username: 'MONGODB_USER',
        password: 'MONGODB_PASSWORD'
      },
      'cryptons/jwt': {
        secret: 'JWT_SECRET',
        refresh_secret: 'JWT_REFRESH_SECRET'
      },
      'cryptons/email': {
        smtp_host: 'SMTP_HOST',
        smtp_port: 'SMTP_PORT',
        smtp_user: 'SMTP_USER',
        smtp_password: 'SMTP_PASSWORD'
      },
      'cryptons/blockchain': {
        btc_address: 'BTC_ADDRESS',
        eth_address: 'ETH_ADDRESS',
        usdt_address: 'USDT_ADDRESS'
      },
      'cryptons/encryption': {
        field_key: 'FIELD_ENCRYPTION_KEY',
        webhook_secret: 'WEBHOOK_SECRET'
      }
    };

    if (key && envVarMap[path] && envVarMap[path][key]) {
      return process.env[envVarMap[path][key]];
    }

    if (envVarMap[path]) {
      const secrets = {};
      Object.entries(envVarMap[path]).forEach(([k, envVar]) => {
        secrets[k] = process.env[envVar];
      });
      return secrets;
    }

    // Direct environment variable lookup
    const envVar = path.toUpperCase().replace(/[/-]/g, '_');
    return process.env[envVar];
  }

  /**
   * Get all application secrets
   * @returns {Promise<Object>} All secrets organized by category
   */
  async getAllSecrets() {
    try {
      const secrets = {
        database: await this.getSecret('cryptons/database'),
        jwt: await this.getSecret('cryptons/jwt'),
        email: await this.getSecret('cryptons/email'),
        blockchain: await this.getSecret('cryptons/blockchain'),
        encryption: await this.getSecret('cryptons/encryption')
      };

      return secrets;
    } catch (error) {
      logger.error('Failed to get all secrets:', error);
      throw error;
    }
  }

  /**
   * Cache a secret
   */
  cacheSecret(key, value) {
    this.secretsCache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached secret if not expired
   */
  getCachedSecret(key) {
    const cached = this.secretsCache.get(key);
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheExpiry) {
      this.secretsCache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Clear secrets cache
   */
  clearCache() {
    this.secretsCache.clear();
    logger.info('Secrets cache cleared');
  }

  /**
   * Check if secrets manager is initialized
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    if (this.tokenRenewalInterval) {
      clearInterval(this.tokenRenewalInterval);
      this.tokenRenewalInterval = null;
    }
    this.clearCache();
    logger.info('Secrets Manager shut down');
  }
}

// Export singleton instance
module.exports = new SecretsManager();
