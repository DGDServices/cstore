# Authenticated User Rate Limiter

## Overview

The `authenticatedUserLimiter` is a rate limiting middleware specifically designed for authenticated users. Unlike traditional IP-based rate limiters, this middleware uses the user's ID from their JWT token as the rate limit key, providing more accurate rate limiting per user rather than per IP address.

## Features

- **User-based rate limiting**: Uses JWT user ID as the key instead of IP address
- **IPv6 support**: Properly handles IPv6 addresses using `ipKeyGenerator` helper
- **Graceful fallback**: Falls back to IP-based rate limiting when:
  - No JWT token is provided
  - JWT token is invalid
  - JWT token doesn't contain a user ID
- **Configurable limits**: Customizable via environment variables
- **Skip unauthenticated requests**: By default, only applies to requests with valid JWT tokens

## Configuration

Configure the rate limiter using environment variables:

```bash
# Time window in minutes (default: 15)
AUTH_USER_RATE_LIMIT_WINDOW=15

# Maximum requests per window (default: 100)
AUTH_USER_RATE_LIMIT_MAX=100
```

## Usage

### Basic Usage

Import and apply the middleware to your routes:

```javascript
const { authenticatedUserLimiter } = require('./src/middleware/security');
const { protect } = require('./src/middleware/auth');

// Apply to specific routes
app.use('/api/user/profile', protect, authenticatedUserLimiter, profileRoutes);

// Apply to all authenticated routes
app.use('/api/protected', protect, authenticatedUserLimiter, protectedRoutes);
```

### Example: Protecting User-Specific Endpoints

```javascript
const express = require('express');
const router = express.Router();
const { authenticatedUserLimiter } = require('../middleware/security');
const { protect } = require('../middleware/auth');

// Apply rate limiting to all routes in this router
router.use(protect, authenticatedUserLimiter);

router.get('/orders', getOrders);
router.post('/orders', createOrder);
router.get('/wishlist', getWishlist);

module.exports = router;
```

## How It Works

1. **Token Extraction**: The middleware extracts the JWT token from the `Authorization` header (Bearer token format)

2. **Token Verification**: Verifies and decodes the JWT token using the `verifyToken` utility

3. **Key Generation**:
   - If token is valid and contains a user ID: Uses `user:${userId}` as the key
   - If token is missing, invalid, or doesn't contain ID: Falls back to IP address (with IPv6 normalization)

4. **Rate Limit Application**: Applies the configured rate limit based on the generated key

5. **Skip Logic**: By default, skips rate limiting for unauthenticated requests (configurable)

## Rate Limit Response

When a user exceeds the rate limit, they receive a 429 (Too Many Requests) response:

```json
{
  "success": false,
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 900
}
```

The `retryAfter` field indicates the number of seconds until the rate limit resets.

## Benefits Over IP-Based Rate Limiting

1. **Accurate per-user limits**: Users can't bypass limits by switching IP addresses
2. **Shared IP environments**: Multiple users behind the same NAT/proxy won't share rate limits
3. **Mobile networks**: Users on mobile networks with frequently changing IPs get consistent rate limits
4. **VPN users**: Users on VPNs can't circumvent rate limits by disconnecting and reconnecting

## Testing

The rate limiter includes comprehensive unit tests:

```bash
npm test -- tests/authenticatedUserLimiter.test.js
```

Tests cover:
- JWT token extraction and user ID usage
- Fallback to IP address for invalid/missing tokens
- Skip function behavior
- IPv6 address handling

## Security Considerations

- **Token validation**: Always uses the `verifyToken` utility to ensure tokens are valid before extracting user IDs
- **IPv6 support**: Uses `ipKeyGenerator` helper to properly normalize IPv6 addresses
- **Audit logging**: Rate limit violations are logged using the `logRateLimitExceeded` audit logger
- **Standard headers**: Includes RateLimit-* headers for client visibility

## Related Middleware

- `limiter`: General IP-based rate limiter for all endpoints
- `authLimiter`: Stricter rate limiter for authentication endpoints (login, register)
- `multiSigApprovalLimiter`: Rate limiter for multi-signature wallet operations
- `protect`: Authentication middleware that verifies JWT tokens

## Example Scenarios

### Scenario 1: E-commerce Order Creation
Limit each authenticated user to 100 order creations per 15 minutes, regardless of their IP address.

### Scenario 2: API Usage
Allow authenticated API users to make 1000 requests per hour based on their user ID, preventing abuse while allowing legitimate high-volume users.

### Scenario 3: User Profile Updates
Restrict profile updates to prevent automated abuse, tracking by user ID rather than IP to catch attackers using proxy rotation.
