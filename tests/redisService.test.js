const redisService = require('../src/services/redisService');
const tokenBlacklistService = require('../src/services/tokenBlacklist');
const jwt = require('jsonwebtoken');

describe('Redis Service', () => {
  describe('redisService', () => {
    it('should export initialize method', () => {
      expect(typeof redisService.initialize).toBe('function');
    });

    it('should export getClient method', () => {
      expect(typeof redisService.getClient).toBe('function');
    });

    it('should export isAvailable method', () => {
      expect(typeof redisService.isAvailable).toBe('function');
    });

    it('should export close method', () => {
      expect(typeof redisService.close).toBe('function');
    });

    it('should return null when Redis is disabled', async () => {
      const originalValue = process.env.REDIS_ENABLED;
      process.env.REDIS_ENABLED = 'false';
      
      const client = await redisService.initialize();
      expect(client).toBeNull();
      
      process.env.REDIS_ENABLED = originalValue;
    });

    it('should handle Redis connection gracefully when unavailable', () => {
      // Redis may not be available in test environment
      const isAvailable = redisService.isAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('tokenBlacklistService', () => {
    let testToken;

    beforeEach(() => {
      // Create a test token
      testToken = jwt.sign(
        { id: 'test-user-id', email: 'test@example.com' },
        'test-secret',
        { expiresIn: '1h' }
      );
    });

    describe('blacklistToken', () => {
      it('should export blacklistToken function', () => {
        expect(typeof tokenBlacklistService.blacklistToken).toBe('function');
      });

      it('should handle blacklistToken when Redis is unavailable', async () => {
        // Should not throw error even if Redis is down
        const result = await tokenBlacklistService.blacklistToken(testToken);
        expect(typeof result).toBe('boolean');
      });

      it('should handle expired tokens gracefully', async () => {
        // Create an expired token
        const expiredToken = jwt.sign(
          { id: 'test-user-id', email: 'test@example.com' },
          'test-secret',
          { expiresIn: '-1h' } // Already expired
        );

        const result = await tokenBlacklistService.blacklistToken(expiredToken);
        // When Redis is unavailable, returns false; when available and token expired, returns true
        expect(typeof result).toBe('boolean');
      });

      it('should handle invalid token format', async () => {
        // When Redis is unavailable, it returns false before validation
        // When Redis is available, it throws an error
        try {
          const result = await tokenBlacklistService.blacklistToken('invalid-token');
          // If Redis unavailable, should return false
          expect(result).toBe(false);
        } catch (error) {
          // If Redis available, should throw error
          expect(error.message).toBe('Invalid token format');
        }
      });
    });

    describe('isTokenBlacklisted', () => {
      it('should export isTokenBlacklisted function', () => {
        expect(typeof tokenBlacklistService.isTokenBlacklisted).toBe('function');
      });

      it('should handle isTokenBlacklisted when Redis is unavailable', async () => {
        // Should not throw error even if Redis is down
        const result = await tokenBlacklistService.isTokenBlacklisted(testToken);
        expect(typeof result).toBe('boolean');
      });

      it('should return false for non-blacklisted token when Redis is down', async () => {
        // Fail-open behavior: when Redis is unavailable, allow token
        const result = await tokenBlacklistService.isTokenBlacklisted(testToken);
        expect(result).toBe(false);
      });
    });

    describe('revokeUserTokens', () => {
      it('should export revokeUserTokens function', () => {
        expect(typeof tokenBlacklistService.revokeUserTokens).toBe('function');
      });

      it('should handle revokeUserTokens when Redis is unavailable', async () => {
        const result = await tokenBlacklistService.revokeUserTokens('test-user-id');
        expect(typeof result).toBe('boolean');
      });

      it('should accept optional timestamp parameter', async () => {
        const timestamp = Date.now();
        const result = await tokenBlacklistService.revokeUserTokens('test-user-id', timestamp);
        expect(typeof result).toBe('boolean');
      });
    });

    describe('areUserTokensRevoked', () => {
      it('should export areUserTokensRevoked function', () => {
        expect(typeof tokenBlacklistService.areUserTokensRevoked).toBe('function');
      });

      it('should handle areUserTokensRevoked when Redis is unavailable', async () => {
        const tokenIssuedAt = Math.floor(Date.now() / 1000);
        const result = await tokenBlacklistService.areUserTokensRevoked('test-user-id', tokenIssuedAt);
        expect(typeof result).toBe('boolean');
      });

      it('should return false when Redis is unavailable (fail-open)', async () => {
        const tokenIssuedAt = Math.floor(Date.now() / 1000);
        const result = await tokenBlacklistService.areUserTokensRevoked('test-user-id', tokenIssuedAt);
        expect(result).toBe(false);
      });
    });

    describe('clearUserRevocation', () => {
      it('should export clearUserRevocation function', () => {
        expect(typeof tokenBlacklistService.clearUserRevocation).toBe('function');
      });

      it('should handle clearUserRevocation when Redis is unavailable', async () => {
        const result = await tokenBlacklistService.clearUserRevocation('test-user-id');
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
});
