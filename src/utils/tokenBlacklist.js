const jwt = require('jsonwebtoken');
const { getRedisClient, isRedisAvailable } = require('../config/redis');
const logger = require('./logger');

/**
 * Behaviour when the revocation store (Redis) is unavailable or errors.
 *   - 'open'   (default): allow the token through — availability over strict
 *               revocation. A logged-out / revoked token is briefly honoured
 *               again during a Redis outage.
 *   - 'closed': deny the token (fail secure) — revocation can never be bypassed,
 *               at the cost of rejecting all token auth while Redis is down.
 *
 * Configured via TOKEN_REVOCATION_FAIL_MODE. Default is 'open' to preserve the
 * historical runtime behaviour; choosing 'closed' is a deliberate security vs.
 * availability decision (see docs/security/JWT_TOKEN_REVOCATION.md#fail-mode-policy).
 */
const isFailClosed = () =>
  (process.env.TOKEN_REVOCATION_FAIL_MODE || 'open').toLowerCase() === 'closed';

/**
 * Emit a structured, alertable security event for a degraded revocation check and
 * return the decision the configured fail-mode dictates.
 * @param {string} reason - 'redis_unavailable' | 'redis_error'
 * @returns {boolean} the value the caller should return (true = revoked/deny)
 */
const degradedDecision = reason => {
  const failClosed = isFailClosed();
  logger.warn('Token revocation store degraded — revocation not enforced via store', {
    event: 'security.token_revocation.degraded',
    reason,
    failMode: failClosed ? 'closed' : 'open',
    action: failClosed ? 'deny' : 'allow',
  });
  return failClosed; // closed → treat as revoked (deny); open → not revoked (allow)
};

/**
 * In-process fallback store, opt-in via TOKEN_REVOCATION_LOCAL_STORE=true,
 * used only when Redis is unavailable AND the process is a single-instance
 * dev/test server. It makes logout, logout-all
 * and password-change revocation actually work without Redis in development
 * and in the test suite. It is never used in production: a per-process store
 * cannot revoke a token across instances, so production keeps the fail-mode
 * policy above.
 */
const useLocalStore = () =>
  process.env.TOKEN_REVOCATION_LOCAL_STORE === 'true' &&
  ['test', 'development'].includes(process.env.NODE_ENV) &&
  !isRedisAvailable();
const localStore = {
  tokens: new Map(), // token -> expiry epoch ms
  users: new Map(), // userId -> revokedAt epoch ms
  sweep() {
    const now = Date.now();
    for (const [k, exp] of this.tokens) if (exp <= now) this.tokens.delete(k);
  },
};

/**
 * JWT `iat` has one-second resolution while revocation timestamps are in
 * milliseconds. Everything issued in or before the revocation second is
 * revoked. The replacement token handed out on password change is therefore
 * minted with an `iat` one second past the revocation (see utils/jwt.js
 * `issuedAt`), so it survives its own revocation.
 */
const issuedBeforeRevocation = (tokenIssuedAtSec, revokedAtMs) =>
  tokenIssuedAtSec <= Math.floor(revokedAtMs / 1000);

class TokenBlacklist {
  /**
   * Add a token to the blacklist
   * @param {string} token - JWT token to blacklist
   */
  async addToBlacklist(token) {
    try {
      if (!isRedisAvailable() && !useLocalStore()) {
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

      if (useLocalStore()) {
        localStore.sweep();
        localStore.tokens.set(token, decoded.exp * 1000);
        return true;
      }

      // Store token in Redis with TTL
      const key = `blacklist:${token}`;
      const redisClient = getRedisClient();
      await redisClient.setEx(key, ttl, 'revoked');

      logger.info(`Token blacklisted successfully for user ${decoded.id}, TTL: ${ttl}s`);
      return true;
    } catch (error) {
      logger.error('Error adding token to blacklist:', error);
      throw error;
    }
  }

  /**
   * Blacklist a token (alias for addToBlacklist)
   * @param {string} token - JWT token to blacklist
   */
  async blacklistToken(token) {
    return this.addToBlacklist(token);
  }

  /**
   * Check if a token is blacklisted
   * @param {string} token - JWT token to check
   * @returns {boolean} - True if blacklisted, false otherwise
   */
  async isBlacklisted(token) {
    try {
      if (useLocalStore()) {
        localStore.sweep();
        return localStore.tokens.has(token);
      }
      if (!isRedisAvailable()) {
        return degradedDecision('redis_unavailable');
      }

      const key = `blacklist:${token}`;
      const redisClient = getRedisClient();
      const result = await redisClient.get(key);
      return result === 'revoked';
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      return degradedDecision('redis_error');
    }
  }

  /**
   * Revoke all tokens for a user (e.g., on password change or security breach)
   * @param {string} userId - User ID
   * @param {number} timestamp - Timestamp after which tokens should be revoked (optional, defaults to now)
   */
  async revokeUserTokens(userId, timestamp = null) {
    try {
      if (!isRedisAvailable() && !useLocalStore()) {
        logger.warn('Redis not available, cannot revoke user tokens');
        return false;
      }

      const revokedAt = timestamp || Date.now();
      if (useLocalStore()) {
        localStore.users.set(String(userId), revokedAt);
        return true;
      }
      const key = `user:${userId}:revoked`;
      const redisClient = getRedisClient();

      // Store revocation timestamp with 30 days TTL (longer than max token lifetime)
      await redisClient.setEx(key, 30 * 24 * 60 * 60, revokedAt.toString());

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
   * @returns {boolean} - True if user tokens are revoked, false otherwise
   */
  async areUserTokensRevoked(userId, tokenIssuedAt) {
    try {
      if (useLocalStore()) {
        const revokedAt = localStore.users.get(String(userId));
        return revokedAt ? issuedBeforeRevocation(tokenIssuedAt, revokedAt) : false;
      }
      if (!isRedisAvailable()) {
        return degradedDecision('redis_unavailable');
      }

      const key = `user:${userId}:revoked`;
      const redisClient = getRedisClient();
      const revokedAt = await redisClient.get(key);

      if (!revokedAt) {
        return false;
      }

      // If token was issued before the revocation timestamp, it's invalid
      return issuedBeforeRevocation(tokenIssuedAt, parseInt(revokedAt));
    } catch (error) {
      logger.error('Error checking user token revocation:', error);
      return degradedDecision('redis_error');
    }
  }

  /**
   * Clear user token revocation (e.g., after resolving security issue)
   * @param {string} userId - User ID
   */
  async clearUserRevocation(userId) {
    try {
      if (useLocalStore()) {
        localStore.users.delete(String(userId));
        return true;
      }
      if (!isRedisAvailable()) {
        logger.warn('Redis not available, cannot clear user revocation');
        return false;
      }

      const key = `user:${userId}:revoked`;
      const redisClient = getRedisClient();
      await redisClient.del(key);

      logger.info(`Cleared token revocation for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error clearing user revocation:', error);
      throw error;
    }
  }
}

const tokenBlacklistInstance = new TokenBlacklist();

/**
 * Check if a token is blacklisted (exported function for convenience)
 * @param {string} token - JWT token to check
 * @returns {boolean} - True if blacklisted, false otherwise
 */
const isTokenBlacklisted = async token => {
  return await tokenBlacklistInstance.isBlacklisted(token);
};

module.exports = tokenBlacklistInstance;
module.exports.isTokenBlacklisted = isTokenBlacklisted;
