const jwt = require('jsonwebtoken');
const redisService = require('./redisService');
const logger = require('../utils/logger');

/**
 * Token Blacklist Service
 * Manages JWT token blacklisting using Redis
 */
class TokenBlacklistService {
  /**
   * Add a token to the blacklist
   * The token will be stored in Redis with an expiration time equal to the token's remaining validity
   * @param {string} token - JWT token to blacklist
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async blacklistToken(token) {
    try {
      if (!redisService.isAvailable()) {
        logger.warn('Redis not available, cannot blacklist token');
        return false;
      }

      const decoded = jwt.decode(token);
      
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token format');
      }
      
      // Calculate TTL (time until token expires)
      const currentTime = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - currentTime;
      
      if (ttl <= 0) {
        // Token already expired, no need to blacklist
        logger.info('Token already expired, skipping blacklist');
        return true;
      }
      
      // Store token in Redis with TTL equal to remaining validity
      const key = `blacklist:${token}`;
      const client = redisService.getClient();
      await client.setEx(key, ttl, 'revoked');
      
      logger.info(`Token blacklisted successfully for user ${decoded.id}, TTL: ${ttl}s`);
      return true;
    } catch (error) {
      logger.error('Error adding token to blacklist:', error);
      throw error;
    }
  }
  
  /**
   * Check if a token is blacklisted
   * @param {string} token - JWT token to check
   * @returns {Promise<boolean>} True if blacklisted, false otherwise
   */
  async isTokenBlacklisted(token) {
    try {
      if (!redisService.isAvailable()) {
        // Fail-safe: If Redis is down, allow the token (logged for monitoring)
        logger.warn('Redis unavailable, allowing token access (fail-open)');
        return false;
      }

      const key = `blacklist:${token}`;
      const client = redisService.getClient();
      const result = await client.get(key);
      return result === 'revoked';
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      // Fail-safe: If Redis error, allow the token
      logger.warn('Redis error, allowing token access (fail-open)');
      return false;
    }
  }

  /**
   * Revoke all tokens for a user (e.g., on password change or security breach)
   * @param {string} userId - User ID
   * @param {number} timestamp - Timestamp after which tokens should be revoked (optional, defaults to now)
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async revokeUserTokens(userId, timestamp = null) {
    try {
      if (!redisService.isAvailable()) {
        logger.warn('Redis not available, cannot revoke user tokens');
        return false;
      }

      const revokedAt = timestamp || Date.now();
      const key = `user:${userId}:revoked`;
      const client = redisService.getClient();
      
      // Store revocation timestamp with 30 days TTL (longer than max token lifetime)
      await client.setEx(key, 30 * 24 * 60 * 60, revokedAt.toString());
      
      logger.info(`All tokens revoked for user ${userId} at ${new Date(revokedAt).toISOString()}`);
      return true;
    } catch (error) {
      logger.error('Error revoking user tokens:', error);
      throw error;
    }
  }

  /**
   * Check if all user tokens are revoked
   * @param {string} userId - User ID
   * @param {number} tokenIssuedAt - Token issued at timestamp (iat claim from JWT)
   * @returns {Promise<boolean>} True if user tokens are revoked, false otherwise
   */
  async areUserTokensRevoked(userId, tokenIssuedAt) {
    try {
      if (!redisService.isAvailable()) {
        logger.warn('Redis unavailable, allowing user token access (fail-open)');
        return false;
      }

      const key = `user:${userId}:revoked`;
      const client = redisService.getClient();
      const revokedAt = await client.get(key);
      
      if (!revokedAt) {
        return false;
      }
      
      // If token was issued before the revocation timestamp, it's invalid
      return tokenIssuedAt * 1000 < parseInt(revokedAt);
    } catch (error) {
      logger.error('Error checking user token revocation:', error);
      return false;
    }
  }

  /**
   * Clear user token revocation (e.g., after resolving security issue)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async clearUserRevocation(userId) {
    try {
      if (!redisService.isAvailable()) {
        logger.warn('Redis not available, cannot clear user revocation');
        return false;
      }

      const key = `user:${userId}:revoked`;
      const client = redisService.getClient();
      await client.del(key);
      
      logger.info(`Cleared token revocation for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error clearing user revocation:', error);
      throw error;
    }
  }
}

// Export singleton instance
const tokenBlacklistService = new TokenBlacklistService();

module.exports = tokenBlacklistService;
