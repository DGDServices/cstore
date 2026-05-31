const { createClient } = require('redis');
const logger = require('../utils/logger');

/**
 * Redis Service
 * Provides a Redis client instance for application-wide use
 */
class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis client
   * @returns {Promise<Object>} Redis client instance
   */
  async initialize() {
    // Check if Redis is enabled
    if (process.env.REDIS_ENABLED !== 'true') {
      logger.info('Redis is disabled. Token revocation will not be available.');
      return null;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD;

      this.client = createClient({
        url: redisUrl,
        password: redisPassword || undefined,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis: Max reconnection attempts reached');
              return new Error('Redis: Max reconnection attempts reached');
            }
            // Exponential backoff: 2^retries * 100ms
            return Math.min(retries * 100, 3000);
          }
        }
      });

      // Error handler
      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      // Connection handler
      this.client.on('connect', () => {
        logger.info('Redis: Connecting...');
      });

      this.client.on('ready', () => {
        logger.info('Redis: Connected and ready');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis: Reconnecting...');
        this.isConnected = false;
      });

      this.client.on('end', () => {
        logger.warn('Redis: Connection closed');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();

      logger.info('Redis service initialized successfully');
      return this.client;
    } catch (error) {
      logger.error('Failed to initialize Redis service:', error);
      this.client = null;
      this.isConnected = false;
      return null;
    }
  }

  /**
   * Get Redis client instance
   * @returns {Object|null} Redis client instance or null if not connected
   */
  getClient() {
    return this.client;
  }

  /**
   * Check if Redis is connected and available
   * @returns {boolean} True if connected, false otherwise
   */
  isAvailable() {
    return this.isConnected && this.client !== null;
  }

  /**
   * Close Redis connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis connection closed');
        this.isConnected = false;
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
      }
    }
  }
}

// Export singleton instance
const redisService = new RedisService();

module.exports = redisService;
