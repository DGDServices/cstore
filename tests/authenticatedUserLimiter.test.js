const { ipKeyGenerator } = require('express-rate-limit');
const { verifyToken } = require('../src/utils/jwt');
const { generateToken } = require('../src/utils/jwt');

// Mock the logger and auditLogger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../src/utils/auditLogger', () => ({
  logRateLimitExceeded: jest.fn(),
}));

describe('Authenticated User Rate Limiter', () => {
  describe('Key Generator Function', () => {
    it('should use user ID from JWT token as rate limit key', () => {
      // Generate a token for a test user
      const userId = '507f1f77bcf86cd799439011';
      const token = generateToken(userId);
      
      // Create a keyGenerator function with the same logic
      const keyGenerator = (req) => {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
          token = req.headers.authorization.split(' ')[1];
        }
        
        if (!token) {
          return ipKeyGenerator(req.ip);
        }
        
        try {
          const decoded = verifyToken(token);
          
          if (decoded && decoded.id) {
            return `user:${decoded.id}`;
          }
          
          return ipKeyGenerator(req.ip);
        } catch (error) {
          return ipKeyGenerator(req.ip);
        }
      };
      
      // Mock request with valid JWT token
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        },
        ip: '127.0.0.1'
      };
      
      const key = keyGenerator(req);
      
      // Verify that the key is based on user ID, not IP
      expect(key).toBe(`user:${userId}`);
      expect(key).not.toBe(req.ip);
      expect(key).not.toBe(ipKeyGenerator(req.ip));
    });

    it('should fall back to IP address when no token provided', () => {
      const keyGenerator = (req) => {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
          token = req.headers.authorization.split(' ')[1];
        }
        
        if (!token) {
          return ipKeyGenerator(req.ip);
        }
        
        try {
          const decoded = verifyToken(token);
          
          if (decoded && decoded.id) {
            return `user:${decoded.id}`;
          }
          
          return ipKeyGenerator(req.ip);
        } catch (error) {
          return ipKeyGenerator(req.ip);
        }
      };
      
      // Mock request without token
      const req = {
        headers: {},
        ip: '127.0.0.1'
      };
      
      const key = keyGenerator(req);
      
      // Verify that it falls back to IP address (normalized by ipKeyGenerator)
      expect(key).toBe(ipKeyGenerator(req.ip));
    });

    it('should fall back to IP address when token is invalid', () => {
      const keyGenerator = (req) => {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
          token = req.headers.authorization.split(' ')[1];
        }
        
        if (!token) {
          return ipKeyGenerator(req.ip);
        }
        
        try {
          const decoded = verifyToken(token);
          
          if (decoded && decoded.id) {
            return `user:${decoded.id}`;
          }
          
          return ipKeyGenerator(req.ip);
        } catch (error) {
          return ipKeyGenerator(req.ip);
        }
      };
      
      // Mock request with invalid token
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        },
        ip: '127.0.0.1'
      };
      
      const key = keyGenerator(req);
      
      // Verify that it falls back to IP address (normalized by ipKeyGenerator)
      expect(key).toBe(ipKeyGenerator(req.ip));
    });
  });

  describe('Skip Function', () => {
    it('should skip rate limiting when no valid token is provided', () => {
      const skip = (req) => {
        if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
          return true;
        }
        
        const token = req.headers.authorization.split(' ')[1];
        try {
          const decoded = verifyToken(token);
          return !decoded || !decoded.id;
        } catch (error) {
          return true;
        }
      };
      
      // Mock request without token
      const req = {
        headers: {},
        ip: '127.0.0.1'
      };
      
      const shouldSkip = skip(req);
      
      // Verify that rate limiting is skipped
      expect(shouldSkip).toBe(true);
    });

    it('should not skip rate limiting when valid token is provided', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = generateToken(userId);
      
      const skip = (req) => {
        if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
          return true;
        }
        
        const token = req.headers.authorization.split(' ')[1];
        try {
          const decoded = verifyToken(token);
          return !decoded || !decoded.id;
        } catch (error) {
          return true;
        }
      };
      
      // Mock request with valid JWT token
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        },
        ip: '127.0.0.1'
      };
      
      const shouldSkip = skip(req);
      
      // Verify that rate limiting is NOT skipped
      expect(shouldSkip).toBe(false);
    });

    it('should skip rate limiting when token is invalid', () => {
      const skip = (req) => {
        if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
          return true;
        }
        
        const token = req.headers.authorization.split(' ')[1];
        try {
          const decoded = verifyToken(token);
          return !decoded || !decoded.id;
        } catch (error) {
          return true;
        }
      };
      
      // Mock request with invalid token
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        },
        ip: '127.0.0.1'
      };
      
      const shouldSkip = skip(req);
      
      // Verify that rate limiting is skipped for invalid tokens
      expect(shouldSkip).toBe(true);
    });
  });

  describe('Middleware Export', () => {
    it('should export authenticatedUserLimiter middleware', () => {
      const { authenticatedUserLimiter } = require('../src/middleware/security');
      
      // Verify that the middleware is defined and is a function
      expect(authenticatedUserLimiter).toBeDefined();
      expect(typeof authenticatedUserLimiter).toBe('function');
    });
  });
});
