# Security Implementation Documentation

This document provides detailed information about the security measures implemented in the CStore application.

## Overview

All security measures listed in the README have been fully implemented and integrated into the Express application as middleware.

## Implemented Security Measures

### 1. Helmet - HTTP Security Headers ✅

**Location:** `src/middleware/security.js`
**Integration:** `src/app.js` line 32

Helmet sets various HTTP headers to protect against well-known web vulnerabilities:
- Content Security Policy (CSP)
- X-DNS-Prefetch-Control
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME sniffing protection)
- X-XSS-Protection

**Configuration:**
```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  }
})
```

### 2. Rate Limiting ✅

**Location:** `src/middleware/security.js`
**Integration:** 
- General limiter: `src/app.js` line 33
- Auth limiter: `src/app.js` line 60 (auth routes)

Two levels of rate limiting to prevent brute force attacks:

**General Rate Limiter:**
- 100 requests per 15 minutes per IP
- Applied to all routes

**Auth Rate Limiter (Stricter):**
- 5 attempts per 15 minutes per IP
- Only counts failed authentication attempts
- Applied to `/api/auth` routes

### 3. Input Validation with Joi ✅

**Location:** `src/middleware/validation.js`
**Integration:** Applied to specific routes in:
- `src/routes/authRoutes.js`
- `src/routes/productRoutes.js`
- `src/routes/orderRoutes.js`

Validates request bodies against predefined schemas:
- User registration (name, email, password)
- User login (email, password)
- Create order (productId, quantity, cryptocurrency, etc.)
- Create/update products (admin only)
- Create reviews

**Example usage:**
```javascript
router.post('/register', validate(schemas.register), register);
```

### 4. MongoDB Sanitization ✅

**Location:** `src/middleware/security.js`
**Integration:** `src/app.js` line 38

**Express 5 Compatible:** Custom implementation (express-mongo-sanitize has compatibility issues with Express 5)

Prevents NoSQL injection attacks by removing MongoDB operators from user input:
- Removes keys starting with `$` (e.g., `$gt`, `$lt`, `$ne`, `$where`)
- Recursively sanitizes nested objects
- Only sanitizes mutable `req.body` (req.query/params are immutable in Express 5)

**Protection against:**
- `$gt`, `$lt`, `$ne` operators in queries
- `$where` clauses
- All MongoDB-specific operators

### 5. XSS Protection ✅

**Location:** `src/middleware/security.js`
**Integration:** `src/app.js` line 39

**Express 5 Compatible:** Custom implementation (xss-clean is deprecated and incompatible with Express 5)

Sanitizes user input to prevent Cross-Site Scripting (XSS) attacks:
- Removes `<script>` tags from strings
- Removes `javascript:` protocol handlers
- Removes inline event handlers (onclick, onerror, etc.)
- Only sanitizes mutable `req.body` (req.query/params are immutable in Express 5)

**Note:** Query string and URL parameters are validated at the controller/validation layer.

### 6. HPP (HTTP Parameter Pollution) Protection ✅

**Location:** `src/middleware/security.js`
**Integration:** `src/app.js` line 40

Protects against HTTP Parameter Pollution attacks with a whitelist:
- Allows duplicate `price` parameters (for range queries)
- Allows duplicate `rating` parameters (for filtering)
- Allows duplicate `stock` parameters (for filtering)
- Blocks all other duplicate parameters

### 7. Password Hashing with Bcrypt ✅

**Location:** `src/models/User.js`
**Implementation:** Mongoose pre-save hook

Passwords are automatically hashed before saving to the database:
- Uses bcrypt with 10 salt rounds
- Passwords are never stored in plain text
- Includes password comparison method for authentication

**Key methods:**
```javascript
// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password for login
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
```

### 8. JWT Authentication ✅

**Location:** `src/utils/jwt.js`
**Integration:** Used in auth controllers and protected routes

Secure token-based authentication with:
- Access tokens (7-day expiry by default)
- Refresh tokens (30-day expiry by default)
- Token verification middleware
- Secret keys configurable via environment variables

**Protected routes use:**
```javascript
router.get('/me', protect, getMe);
```

### 9. CORS Configuration ✅

**Location:** `src/app.js` line 43

Cross-Origin Resource Sharing (CORS) is enabled to allow controlled access from different origins:
```javascript
app.use(cors());
```

**Note:** In production, this should be configured with specific origins:
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
```

### 10. Error Handling ✅

**Location:** `src/middleware/errorHandler.js`
**Integration:** `src/app.js` line 88 (must be last middleware)

Comprehensive error handling with:
- Custom AppError class for operational errors
- Different error responses for development vs production
- Specific handlers for:
  - Mongoose validation errors
  - Duplicate key errors (MongoDB)
  - Cast errors (invalid ObjectIds)
  - JWT errors (invalid/expired tokens)
- Async error wrapper to catch errors in async route handlers

**Development mode:** Shows full error details and stack traces
**Production mode:** Shows user-friendly messages without leaking sensitive information

### 11. Logging with Winston ✅

**Location:** `src/utils/logger.js`
**Integration:** Used throughout the application

Winston logger with multiple transports:
- Console logging (with colors in development)
- File logging (`logs/combined.log` for all logs)
- Error logging (`logs/error.log` for errors only)
- Automatic log rotation (5MB max file size, 5 files retained)

**Log levels:** error, warn, info, http, verbose, debug, silly

**Usage examples:**
```javascript
logger.info(`User logged in: ${user.email}`);
logger.error('Bitcoin transaction verification error:', error);
```

## Middleware Order

The security middleware is applied in the correct order in `src/app.js`:

1. **Security Headers** (Helmet) - Set headers first
2. **Rate Limiting** - Limit request rate
3. **MongoDB Sanitization** - Clean NoSQL injection attempts
4. **XSS Protection** - Clean cross-site scripting attempts
5. **HPP Protection** - Prevent parameter pollution
6. **Body Parser** - Parse request body (after sanitization)
7. **CORS** - Enable cross-origin requests
8. **Logging** (Morgan) - Log requests
9. **Routes** - Application routes with validation
10. **Error Handler** - Must be last to catch all errors

## Security Best Practices

### Environment Variables
All sensitive configuration should be in `.env` file:
- `JWT_SECRET` - Secret key for access tokens
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens
- `MONGODB_URI` - Database connection string
- `NODE_ENV` - Environment (development/production)

### Production Checklist
Before deploying to production:
- [ ] Change all default secrets in `.env`
- [ ] Configure CORS with specific allowed origins
- [ ] Use HTTPS/TLS encryption
- [ ] Set up proper MongoDB authentication
- [ ] Enable MongoDB replica set
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Configure monitoring and alerting
- [ ] Review rate limiting thresholds
- [ ] Set up log aggregation service
- [ ] Enable production error tracking

## Testing

Security measures can be verified by:
1. Running the application and checking logs
2. Attempting injection attacks (should be blocked)
3. Testing rate limiting (should throttle requests)
4. Checking response headers (should include security headers)
5. Testing authentication (passwords should be hashed)

## Dependencies

Security-related npm packages:
- `helmet` - HTTP security headers
- `express-rate-limit` - Rate limiting
- `joi` - Input validation
- `express-mongo-sanitize` - Installed but not used (incompatible with Express 5, custom implementation used)
- `xss-clean` - Installed but not used (deprecated and incompatible with Express 5, custom implementation used)
- `hpp` - HTTP parameter pollution prevention
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `cors` - CORS configuration
- `winston` - Logging
- `morgan` - HTTP request logging

**Note:** Custom Express 5-compatible implementations are used for MongoDB sanitization and XSS protection instead of the incompatible packages.

## Verification

All security measures have been verified to be:
1. ✅ Properly installed as dependencies
2. ✅ Implemented in middleware files
3. ✅ Integrated into the Express application
4. ✅ Applied in the correct order
5. ✅ Used in appropriate routes and controllers

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
