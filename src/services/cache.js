const { getRedisClient, isRedisAvailable } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Caching Service with intelligent strategies
 * Provides Redis-based caching with TTL and invalidation
 */
class CacheService {
  constructor() {
    this.enabled = process.env.CACHE_ENABLED === 'true';
    this.defaultTTL = parseInt(process.env.CACHE_TTL || '3600', 10);
    this.prefix = 'cryptons:';
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.enabled || !isRedisAvailable()) {
      return null;
    }

    try {
      const redisClient = getRedisClient();
      const fullKey = this.prefix + key;
      const value = await redisClient.get(fullKey);
      
      if (value) {
        logger.debug(`Cache hit: ${key}`);
        return JSON.parse(value);
      }
      
      logger.debug(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = null) {
    if (!this.enabled || !isRedisAvailable()) {
      return false;
    }

    try {
      const redisClient = getRedisClient();
      const fullKey = this.prefix + key;
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;

      await redisClient.setEx(fullKey, expiry, serialized);
      logger.debug(`Cache set: ${key} (TTL: ${expiry}s)`);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key) {
    if (!this.enabled || !isRedisAvailable()) {
      return false;
    }

    try {
      const redisClient = getRedisClient();
      const fullKey = this.prefix + key;
      await redisClient.del(fullKey);
      logger.debug(`Cache deleted: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern) {
    if (!this.enabled || !isRedisAvailable()) {
      return 0;
    }

    try {
      const redisClient = getRedisClient();
      const fullPattern = this.prefix + pattern;
      const keys = await redisClient.keys(fullPattern);
      
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.debug(`Cache deleted ${keys.length} keys matching: ${pattern}`);
        return keys.length;
      }
      
      return 0;
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key) {
    if (!this.enabled || !isRedisAvailable()) {
      return false;
    }

    try {
      const redisClient = getRedisClient();
      const fullKey = this.prefix + key;
      const exists = await redisClient.exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set value (cache-aside pattern)
   */
  async getOrSet(key, fetchFunction, ttl = null) {
    // Try to get from cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    try {
      const data = await fetchFunction();
      
      // Store in cache
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttl);
      }
      
      return data;
    } catch (error) {
      logger.error(`Cache getOrSet error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Increment counter
   */
  async increment(key, delta = 1) {
    if (!this.enabled || !isRedisAvailable()) {
      return null;
    }

    try {
      const redisClient = getRedisClient();
      const fullKey = this.prefix + key;
      const value = await redisClient.incrBy(fullKey, delta);
      return value;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set expiration on existing key
   */
  async expire(key, ttl) {
    if (!this.enabled || !isRedisAvailable()) {
      return false;
    }

    try {
      const redisClient = getRedisClient();
      const fullKey = this.prefix + key;
      await redisClient.expire(fullKey, ttl);
      return true;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for key
   */
  async ttl(key) {
    if (!this.enabled || !isRedisAvailable()) {
      return -1;
    }

    try {
      const redisClient = getRedisClient();
      const fullKey = this.prefix + key;
      return await redisClient.ttl(fullKey);
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Flush all cache entries with prefix
   */
  async flush() {
    if (!this.enabled || !isRedisAvailable()) {
      return 0;
    }

    try {
      return await this.delPattern('*');
    } catch (error) {
      logger.error('Cache flush error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.enabled || !isRedisAvailable()) {
      return {
        enabled: false,
        available: false
      };
    }

    try {
      const redisClient = getRedisClient();
      const info = await redisClient.info('stats');
      
      // Parse Redis INFO output
      const stats = {};
      info.split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return {
        enabled: true,
        available: true,
        stats,
        prefix: this.prefix,
        defaultTTL: this.defaultTTL
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return {
        enabled: true,
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Invalidate cache for specific entity type
   */
  async invalidateEntity(entityType, entityId = '*') {
    const pattern = `${entityType}:${entityId}`;
    return await this.delPattern(pattern);
  }

  /**
   * Cache middleware for Express routes
   */
  middleware(ttl = null) {
    return async (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = `route:${req.originalUrl}`;
      
      try {
        const cached = await this.get(cacheKey);
        
        if (cached) {
          res.set('X-Cache', 'HIT');
          return res.json(cached);
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to cache response
        res.json = (data) => {
          this.set(cacheKey, data, ttl).catch(err => {
            logger.error('Cache middleware set error:', err);
          });
          res.set('X-Cache', 'MISS');
          return originalJson(data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }
}

module.exports = new CacheService();
