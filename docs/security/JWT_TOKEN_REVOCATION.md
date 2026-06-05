# JWT Token Revocation Implementation Guide

**Status**: 🔴 CRITICAL - Not Implemented  
**Priority**: HIGH  
**CVSS Score**: 6.5 (MEDIUM)  
**Timeline**: 1-2 weeks

---

## Overview

Currently, JWT tokens issued by Cryptons.com cannot be revoked before their expiration time. This means if a token is compromised or a user logs out, the token remains valid until it naturally expires (7 days by default). This poses a security risk.

## Problem Statement

**Current Behavior:**
- User logs out → Token still valid and can be used
- Password changed → Old tokens still valid
- Security breach detected → Cannot invalidate compromised tokens
- Admin disabled account → User can still access with existing token

**Security Impact:**
- Compromised tokens remain active for up to 7 days
- No way to force logout across all devices
- Cannot immediately revoke access after security incidents

## Recommended Solution: Redis-Based Token Blacklist

### Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │────────▶│   Express   │────────▶│    Redis    │
│  (Browser)  │   JWT   │  Middleware │  Check  │  Blacklist  │
└─────────────┘         └─────────────┘         └─────────────┘
                              │                        │
                              │  Token Valid?          │
                              │◀───────────────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │  Protected  │
                        │   Routes    │
                        └─────────────┘
```

### Implementation Steps

#### 1. Install Redis Client

```bash
npm install redis
```

Update `package.json`:
```json
{
  "dependencies": {
    "redis": "^4.6.0"
  }
}
```

#### 2. Configure Redis Connection

Create `src/config/redis.js`:

```javascript
const redis = require('redis');
const logger = require('../utils/logger');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis reconnection failed after 10 retries');
        return new Error('Redis reconnection failed');
      }
      return retries * 100; // Exponential backoff
    }
  }
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await redisClient.connect();
    logger.info('Redis connection established');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

module.exports = {
  redisClient,
  connectRedis
};
```

#### 3. Create Token Blacklist Utility

Create `src/utils/tokenBlacklist.js`:

```javascript
const { redisClient } = require('../config/redis');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

class TokenBlacklist {
  /**
   * Add a token to the blacklist
   * @param {string} token - JWT token to blacklist
   */
  async addToBlacklist(token) {
    try {
      const decoded = jwt.decode(token);
      
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token format');
      }
      
      // Calculate TTL (time until token expires)
      const currentTime = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - currentTime;
      
      if (ttl <= 0) {
        // Token already expired, no need to blacklist
        return;
      }
      
      // Store token in Redis with TTL
      const key = `blacklist:${token}`;
      await redisClient.setEx(key, ttl, 'revoked');
      
      logger.info(`Token blacklisted: ${decoded.id}, TTL: ${ttl}s`);
    } catch (error) {
      logger.error('Error adding token to blacklist:', error);
      throw error;
    }
  }
  
  /**
   * Check if a token is blacklisted
   * @param {string} token - JWT token to check
   * @returns {boolean} - True if blacklisted, false otherwise
   */
  async isBlacklisted(token) {
    try {
      const key = `blacklist:${token}`;
      const result = await redisClient.get(key);
      return result === 'revoked';
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      // Fail-safe: If Redis is down, allow the token (logged for monitoring)
      logger.warn('Redis unavailable, allowing token access');
      return false;
    }
  }
  
  /**
   * Revoke all tokens for a user
   * @param {string} userId - User ID
   */
  async revokeAllUserTokens(userId) {
    try {
      const key = `user:${userId}:revoked`;
      const timestamp = Date.now();
      
      // Store revocation timestamp with 30-day expiry (max refresh token lifetime)
      await redisClient.setEx(key, 30 * 24 * 60 * 60, timestamp.toString());
      
      logger.info(`All tokens revoked for user: ${userId}`);
    } catch (error) {
      logger.error('Error revoking all user tokens:', error);
      throw error;
    }
  }
  
  /**
   * Check if all user tokens are revoked
   * @param {string} userId - User ID
   * @param {number} tokenIssuedAt - Token issued timestamp (iat claim)
   * @returns {boolean} - True if user tokens are revoked, false otherwise
   */
  async areUserTokensRevoked(userId, tokenIssuedAt) {
    try {
      const key = `user:${userId}:revoked`;
      const revokedAt = await redisClient.get(key);
      
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
}

module.exports = new TokenBlacklist();
```

#### 4. Update Authentication Middleware

Update `src/middleware/auth.js`:

```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');
const tokenBlacklist = require('../utils/tokenBlacklist');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  try {
    let token;
    
    // Extract token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }
    
    // Check if token is blacklisted
    const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) {
      logger.warn(`Blacklisted token attempt: ${token.substring(0, 20)}...`);
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked'
      });
    }
    
    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    // Check if all user tokens are revoked (password change, security breach, etc.)
    const areRevoked = await tokenBlacklist.areUserTokensRevoked(decoded.id, decoded.iat);
    if (areRevoked) {
      logger.warn(`Revoked user token attempt: User ${decoded.id}`);
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked. Please log in again.'
      });
    }
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

module.exports = { protect, authorize };
```

#### 5. Update Logout Endpoint

Update `src/controllers/authController.js`:

```javascript
const tokenBlacklist = require('../utils/tokenBlacklist');

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    
    // Add token to blacklist
    await tokenBlacklist.addToBlacklist(token);
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during logout'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    
    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Revoke all existing tokens
    await tokenBlacklist.revokeAllUserTokens(user._id.toString());
    
    // Generate new token
    const token = generateToken(user._id);
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      token
    });
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password change'
    });
  }
};
```

#### 6. Update Server Initialization

Update `server-new.js` or `server.js`:

```javascript
const { connectRedis } = require('./src/config/redis');

// Connect to Redis
connectRedis()
  .then(() => {
    logger.info('Redis connected successfully');
  })
  .catch((err) => {
    logger.error('Failed to connect to Redis:', err);
    process.exit(1);
  });

// Rest of your server initialization...
```

#### 7. Update Environment Variables

Add to `.env`:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
```

Update `.env.example`:

```env
# Redis Configuration (for JWT token revocation)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password-in-production
```

#### 8. Update Docker Compose

Update `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    # ... existing config
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis

  mongodb:
    # ... existing config

  redis:
    image: redis:7-alpine
    container_name: cryptons-redis
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    networks:
      - cryptons-network

volumes:
  mongo-data:
  redis-data:

networks:
  cryptons-network:
    driver: bridge
```

### Testing

#### Unit Tests

Create `tests/tokenBlacklist.test.js`:

```javascript
const tokenBlacklist = require('../src/utils/tokenBlacklist');
const jwt = require('jsonwebtoken');

describe('Token Blacklist', () => {
  const testToken = jwt.sign({ id: 'test-user-id' }, 'test-secret', { expiresIn: '1h' });
  
  it('should add token to blacklist', async () => {
    await tokenBlacklist.addToBlacklist(testToken);
    const isBlacklisted = await tokenBlacklist.isBlacklisted(testToken);
    expect(isBlacklisted).toBe(true);
  });
  
  it('should return false for non-blacklisted token', async () => {
    const newToken = jwt.sign({ id: 'another-user' }, 'test-secret', { expiresIn: '1h' });
    const isBlacklisted = await tokenBlacklist.isBlacklisted(newToken);
    expect(isBlacklisted).toBe(false);
  });
  
  it('should revoke all user tokens', async () => {
    const userId = 'test-user-123';
    await tokenBlacklist.revokeAllUserTokens(userId);
    
    const oldToken = jwt.sign({ id: userId, iat: Math.floor(Date.now() / 1000) - 100 }, 'test-secret');
    const areRevoked = await tokenBlacklist.areUserTokensRevoked(userId, oldToken.iat);
    expect(areRevoked).toBe(true);
  });
});
```

#### Integration Tests

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Run tests
npm test
```

### Monitoring

Add monitoring for Redis health:

```javascript
// In your monitoring/health check endpoint
app.get('/health', async (req, res) => {
  try {
    await redisClient.ping();
    res.status(200).json({
      status: 'healthy',
      redis: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      redis: 'disconnected'
    });
  }
});
```

## Production Considerations

### High Availability

For production, use Redis Cluster or Sentinel:

```yaml
# Redis Sentinel configuration
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
  
redis-sentinel-1:
  image: redis:7-alpine
  command: redis-sentinel /etc/redis/sentinel.conf
  
redis-sentinel-2:
  image: redis:7-alpine
  command: redis-sentinel /etc/redis/sentinel.conf
```

### Performance Optimization

1. **Connection Pooling**: Redis client handles this automatically
2. **Pipeline Operations**: Batch multiple blacklist checks
3. **Memory Management**: Monitor Redis memory usage
4. **TTL Optimization**: Tokens auto-expire, no manual cleanup needed

### Security

1. **Use Redis Password**: Set `REDIS_PASSWORD` in production
2. **Enable TLS**: Use `rediss://` URL for encrypted connections
3. **Network Isolation**: Keep Redis in private network
4. **Access Control**: Use Redis ACLs for fine-grained permissions

## Alternative Solutions

### 1. Database-Based Blacklist (Not Recommended)
- ❌ Slower than Redis
- ❌ Adds load to main database
- ✅ No additional infrastructure needed

### 2. Token Versioning
- ✅ Simple implementation
- ❌ Cannot revoke individual tokens
- ❌ Requires database query on every request

### 3. Short-Lived Tokens + Refresh Tokens
- ✅ Reduces exposure window
- ❌ Still needs blacklist for immediate revocation
- ✅ Good complementary approach

## Rollout Plan

1. **Week 1**: Development and testing
2. **Week 2**: Staging deployment and load testing
3. **Week 3**: Production deployment with monitoring
4. **Week 4**: Review and optimization

## Success Metrics

- ✅ Tokens can be revoked immediately on logout
- ✅ Password changes invalidate all tokens
- ✅ 99.9% Redis availability
- ✅ < 10ms latency for blacklist checks
- ✅ Zero security incidents related to token revocation

---

**Status**: Implementation Required  
**Owner**: Backend Team  
**Estimated Effort**: 40-60 hours  
**Dependencies**: Redis infrastructure

---

## Fail-mode policy

When the revocation store (Redis) is **unavailable or errors**, the read-side checks
(`isTokenBlacklisted`, `areUserTokensRevoked`) cannot consult the blacklist. The
behaviour is an explicit, configurable policy rather than a silent default:

| `TOKEN_REVOCATION_FAIL_MODE` | Behaviour on Redis outage | Trade-off |
|---|---|---|
| `open` (default) | Token is **allowed** through | Availability first. A revoked / logged-out token is briefly honoured again until Redis recovers. |
| `closed` | Token is **denied** (fail secure) | Revocation can never be bypassed, but an outage rejects all token auth (effectively logs everyone out) until Redis recovers. |

The default is `open` to preserve historical runtime behaviour; switching to `closed`
is a deliberate **security-vs-availability** decision and should be made together with
Redis HA so an outage can't lock everyone out.

### Observability (alert on this)

Every degraded check emits one structured log event — wire an alert to it so the gap
is never silent:

```
level: warn
message: "Token revocation store degraded — revocation not enforced via store"
event:   security.token_revocation.degraded
reason:  redis_unavailable | redis_error
failMode: open | closed
action:  allow | deny
```

A sustained stream of these events means revocation is not being enforced via the
store and Redis needs attention. Recommended alert: any occurrence in production, and
page if the rate exceeds a few per minute.

### Decision record

- **2026-06-05** — Made the previously hard-coded fail-**open** behaviour explicit and
  configurable (`TOKEN_REVOCATION_FAIL_MODE`), and replaced the generic warning with the
  alertable `security.token_revocation.degraded` event. Default left at `open` to avoid
  changing runtime behaviour without an ops decision. **Open item:** choose the
  production value once Redis HA is in place; until then `open` is the safer default for
  availability. Covered by `tests/tokenRevocationFailMode.test.js`.
