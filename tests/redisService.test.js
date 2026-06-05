/**
 * Redis layer + token blacklist smoke tests.
 *
 * Targets the canonical modules used by the live auth path:
 *   - Redis layer:      src/config/redis      (initRedisClient/getRedisClient/
 *                                              isRedisAvailable/closeRedisConnection)
 *   - Token blacklist:  src/utils/tokenBlacklist (backed by config/redis)
 *
 * Previously these tests pointed at the duplicate src/services/redisService.js +
 * src/services/tokenBlacklist.js modules, which were never wired into the app.
 * They have been consolidated away; see docs/security/JWT_TOKEN_REVOCATION.md.
 *
 * Runs without a live Redis (REDIS_ENABLED is not 'true' in the test env), so the
 * blacklist exercises its degraded/fail-open path. Fail-mode policy itself is
 * covered in detail by tokenRevocationFailMode.test.js.
 */

const redis = require('../src/config/redis');
const tokenBlacklist = require('../src/utils/tokenBlacklist');
const jwt = require('jsonwebtoken');

describe('Redis layer (config/redis)', () => {
  it('should export initRedisClient method', () => {
    expect(typeof redis.initRedisClient).toBe('function');
  });

  it('should export getRedisClient method', () => {
    expect(typeof redis.getRedisClient).toBe('function');
  });

  it('should export isRedisAvailable method', () => {
    expect(typeof redis.isRedisAvailable).toBe('function');
  });

  it('should export closeRedisConnection method', () => {
    expect(typeof redis.closeRedisConnection).toBe('function');
  });

  it('should return null when Redis is disabled', async () => {
    const originalValue = process.env.REDIS_ENABLED;
    process.env.REDIS_ENABLED = 'false';

    const client = await redis.initRedisClient();
    expect(client).toBeNull();

    process.env.REDIS_ENABLED = originalValue;
  });

  it('should handle Redis connection gracefully when unavailable', () => {
    // Redis may not be available in test environment
    const isAvailable = redis.isRedisAvailable();
    expect(typeof isAvailable).toBe('boolean');
  });
});

describe('Token blacklist (utils/tokenBlacklist)', () => {
  let testToken;

  beforeEach(() => {
    // Create a test token
    testToken = jwt.sign(
      { id: 'test-user-id', email: 'test@example.com' },
      'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('blacklistToken / addToBlacklist', () => {
    it('should export blacklistToken function', () => {
      expect(typeof tokenBlacklist.blacklistToken).toBe('function');
    });

    it('should export addToBlacklist function', () => {
      expect(typeof tokenBlacklist.addToBlacklist).toBe('function');
    });

    it('should handle blacklistToken when Redis is unavailable', async () => {
      // Should not throw error even if Redis is down
      const result = await tokenBlacklist.blacklistToken(testToken);
      expect(typeof result).toBe('boolean');
    });

    it('should handle expired tokens gracefully', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { id: 'test-user-id', email: 'test@example.com' },
        'test-secret',
        { expiresIn: '-1h' } // Already expired
      );

      const result = await tokenBlacklist.blacklistToken(expiredToken);
      // When Redis is unavailable, returns false; when available and token expired, returns true
      expect(typeof result).toBe('boolean');
    });

    it('should handle invalid token format', async () => {
      // When Redis is unavailable, it returns false before validation
      // When Redis is available, it throws an error
      try {
        const result = await tokenBlacklist.blacklistToken('invalid-token');
        // If Redis unavailable, should return false
        expect(result).toBe(false);
      } catch (error) {
        // If Redis available, should throw error
        expect(error.message).toBe('Invalid token format');
      }
    });
  });

  describe('isBlacklisted / isTokenBlacklisted', () => {
    it('should export isBlacklisted function', () => {
      expect(typeof tokenBlacklist.isBlacklisted).toBe('function');
    });

    it('should export isTokenBlacklisted convenience function', () => {
      expect(typeof tokenBlacklist.isTokenBlacklisted).toBe('function');
    });

    it('should handle isBlacklisted when Redis is unavailable', async () => {
      // Should not throw error even if Redis is down
      const result = await tokenBlacklist.isBlacklisted(testToken);
      expect(typeof result).toBe('boolean');
    });

    it('should return false for non-blacklisted token when Redis is down (default fail-open)', async () => {
      // Default fail-mode is 'open': when Redis is unavailable, allow the token.
      const result = await tokenBlacklist.isBlacklisted(testToken);
      expect(result).toBe(false);
    });
  });

  describe('revokeUserTokens', () => {
    it('should export revokeUserTokens function', () => {
      expect(typeof tokenBlacklist.revokeUserTokens).toBe('function');
    });

    it('should handle revokeUserTokens when Redis is unavailable', async () => {
      const result = await tokenBlacklist.revokeUserTokens('test-user-id');
      expect(typeof result).toBe('boolean');
    });

    it('should accept optional timestamp parameter', async () => {
      const timestamp = Date.now();
      const result = await tokenBlacklist.revokeUserTokens('test-user-id', timestamp);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('areUserTokensRevoked', () => {
    it('should export areUserTokensRevoked function', () => {
      expect(typeof tokenBlacklist.areUserTokensRevoked).toBe('function');
    });

    it('should handle areUserTokensRevoked when Redis is unavailable', async () => {
      const tokenIssuedAt = Math.floor(Date.now() / 1000);
      const result = await tokenBlacklist.areUserTokensRevoked('test-user-id', tokenIssuedAt);
      expect(typeof result).toBe('boolean');
    });

    it('should return false when Redis is unavailable (default fail-open)', async () => {
      const tokenIssuedAt = Math.floor(Date.now() / 1000);
      const result = await tokenBlacklist.areUserTokensRevoked('test-user-id', tokenIssuedAt);
      expect(result).toBe(false);
    });
  });

  describe('clearUserRevocation', () => {
    it('should export clearUserRevocation function', () => {
      expect(typeof tokenBlacklist.clearUserRevocation).toBe('function');
    });

    it('should handle clearUserRevocation when Redis is unavailable', async () => {
      const result = await tokenBlacklist.clearUserRevocation('test-user-id');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Integration with Redis', () => {
    it('should properly calculate token TTL', () => {
      const decoded = jwt.decode(testToken);
      expect(decoded).toBeDefined();
      expect(decoded.exp).toBeDefined();

      const currentTime = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - currentTime;
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600); // 1 hour max
    });
  });
});
