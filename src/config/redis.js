const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis client for token blacklist and caching
 */
const initRedisClient = async () => {
  // Check if Redis is enabled
  if (process.env.REDIS_ENABLED !== 'true') {
    logger.info('Redis is disabled. Token revocation will not be available.');
    return null;
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD;

    redisClient = createClient({
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
    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      isConnected = false;
    });

    // Connection handler
    redisClient.on('connect', () => {
      logger.info('Redis: Connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis: Connected and ready');
      isConnected = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis: Reconnecting...');
      isConnected = false;
    });

    redisClient.on('end', () => {
      logger.warn('Redis: Connection closed');
      isConnected = false;
    });

    // Connect to Redis
    await redisClient.connect();

    logger.info('Redis client initialized successfully');
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis client:', error);
    redisClient = null;
    isConnected = false;
    return null;
  }
};

/**
 * Get Redis client instance
 */
const getRedisClient = () => {
  return redisClient;
};

/**
 * Check if Redis is connected and available
 */
const isRedisAvailable = () => {
  return isConnected && redisClient !== null;
};

/**
 * Close Redis connection
 */
const closeRedisConnection = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
};

module.exports = {
  initRedisClient,
  getRedisClient,
  isRedisAvailable,
  closeRedisConnection,
  get redisClient() {
    return redisClient;
  }
};
