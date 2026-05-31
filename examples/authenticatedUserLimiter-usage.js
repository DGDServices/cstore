/**
 * Example usage of authenticatedUserLimiter middleware
 * 
 * This example demonstrates how to use the authenticatedUserLimiter
 * middleware to rate limit authenticated users based on their JWT user ID
 * instead of their IP address.
 */

const express = require('express');
const { authenticatedUserLimiter } = require('../src/middleware/security');
const { protect } = require('../src/middleware/auth');

const app = express();

// ============================================
// Example 1: Basic Usage - Single Route
// ============================================

app.get('/api/user/profile', 
  protect,                      // First authenticate the user
  authenticatedUserLimiter,     // Then apply per-user rate limiting
  (req, res) => {
    res.json({ 
      user: req.user,
      message: 'Profile fetched successfully' 
    });
  }
);

// ============================================
// Example 2: Apply to Multiple Routes
// ============================================

const userRouter = express.Router();

// Apply to all routes in this router
userRouter.use(protect);
userRouter.use(authenticatedUserLimiter);

userRouter.get('/orders', (req, res) => {
  res.json({ orders: [] });
});

userRouter.post('/orders', (req, res) => {
  res.json({ message: 'Order created' });
});

userRouter.get('/wishlist', (req, res) => {
  res.json({ wishlist: [] });
});

app.use('/api/user', userRouter);

// ============================================
// Example 3: Selective Application
// ============================================

const apiRouter = express.Router();

// Public endpoint - no rate limiting
apiRouter.get('/products', (req, res) => {
  res.json({ products: [] });
});

// Authenticated endpoint with per-user rate limiting
apiRouter.get('/my-data', 
  protect, 
  authenticatedUserLimiter,
  (req, res) => {
    res.json({ data: 'User-specific data' });
  }
);

// Admin endpoint with authentication but no per-user rate limiting
// (using the global IP-based rate limiter instead)
const { authorize } = require('../src/middleware/auth');
apiRouter.delete('/admin/purge', 
  protect, 
  authorize('admin'),
  (req, res) => {
    res.json({ message: 'Data purged' });
  }
);

app.use('/api', apiRouter);

// ============================================
// Example 4: Environment-based Configuration
// ============================================

// In your .env file:
// AUTH_USER_RATE_LIMIT_WINDOW=60  # 60 minutes
// AUTH_USER_RATE_LIMIT_MAX=500    # 500 requests per window

// The middleware will automatically use these values

// ============================================
// Example 5: Error Handling
// ============================================

// When rate limit is exceeded, the user gets:
// {
//   "success": false,
//   "error": "Too many requests",
//   "message": "You have exceeded the rate limit. Please try again later.",
//   "retryAfter": 900  // seconds until reset
// }

// ============================================
// Example 6: Combining with Other Middleware
// ============================================

const orderRouter = express.Router();

orderRouter.use(protect);                    // Authenticate user
orderRouter.use(authenticatedUserLimiter);   // Rate limit by user ID

// Additional validation middleware
const { validateOrder } = require('../src/middleware/validation');

orderRouter.post('/', 
  validateOrder,  // Validate request body
  (req, res) => {
    // Create order logic here
    res.status(201).json({ message: 'Order created' });
  }
);

app.use('/api/orders', orderRouter);

// ============================================
// Example 7: Monitoring Rate Limit Headers
// ============================================

// Clients can check rate limit status via response headers:
// RateLimit-Limit: 100
// RateLimit-Remaining: 85
// RateLimit-Reset: 1234567890

app.get('/api/data',
  protect,
  authenticatedUserLimiter,
  (req, res) => {
    // The headers are automatically added by the middleware
    res.json({ 
      data: 'Some data',
      rateLimit: {
        limit: res.getHeader('RateLimit-Limit'),
        remaining: res.getHeader('RateLimit-Remaining'),
        reset: res.getHeader('RateLimit-Reset')
      }
    });
  }
);

// ============================================
// Export for testing
// ============================================

module.exports = app;

// ============================================
// Key Benefits of User-Based Rate Limiting
// ============================================

/**
 * 1. ACCURATE PER-USER LIMITS
 *    - User A with 100 requests != User B with 100 requests
 *    - Each user gets their own independent rate limit
 * 
 * 2. PREVENT IP ROTATION ATTACKS
 *    - Attacker can't bypass limit by changing IPs
 *    - Rate limit follows the user ID, not the IP
 * 
 * 3. SHARED IP ENVIRONMENTS
 *    - Multiple users behind same NAT don't share limits
 *    - Office buildings, schools, etc. work properly
 * 
 * 4. MOBILE NETWORKS
 *    - Users on cellular networks with changing IPs
 *    - Get consistent rate limits as they move
 * 
 * 5. VPN USERS
 *    - Users on VPNs can't circumvent limits
 *    - By disconnecting and reconnecting to get new IP
 * 
 * 6. AUDIT & COMPLIANCE
 *    - Better tracking of which user exceeded limits
 *    - Logged with user ID for investigation
 */
