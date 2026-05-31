# Security Features Implementation Guide

**Status**: ✅ IMPLEMENTED  
**Version**: 1.0.0  
**Last Updated**: 2025-10-05

---

## Overview

This document describes the critical security features implemented to meet production deployment requirements. All features are production-ready and follow industry best practices.

## Table of Contents

1. [JWT Token Revocation](#jwt-token-revocation)
2. [Webhook Signature Verification](#webhook-signature-verification)
3. [Database Field Encryption](#database-field-encryption)
4. [Production CORS Configuration](#production-cors-configuration)
5. [Secrets Management](#secrets-management)
6. [Audit Logging](#audit-logging)
7. [Enhanced Error Handling](#enhanced-error-handling)
8. [Security Headers](#security-headers)

---

## JWT Token Revocation

### Overview

Implements a Redis-based token blacklist to enable secure logout and token revocation.

### Features

- **Token Blacklist**: Store revoked tokens in Redis with automatic expiration
- **User-Level Revocation**: Revoke all tokens for a user (e.g., on password change)
- **Logout Endpoint**: `/api/auth/logout` - Revoke single token
- **Logout All Endpoint**: `/api/auth/logout-all` - Revoke all user tokens
- **Fail-Open Design**: If Redis unavailable, allows access (logged for monitoring)

### Configuration

```env
# Enable Redis for token revocation
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
```

### Usage

#### Logout Single Session

```bash
POST /api/auth/logout
Authorization: Bearer <token>
```

#### Logout All Sessions

```bash
POST /api/auth/logout-all
Authorization: Bearer <token>
```

#### Password Change (Auto-Revokes All Tokens)

```bash
PUT /api/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

### Implementation Details

- Tokens stored with key: `blacklist:{token}`
- TTL matches token expiration time
- User revocation key: `user:{userId}:revoked`
- Automatic cleanup by Redis TTL

### Testing

```javascript
// Test token revocation
const res = await request(app)
  .post('/api/auth/logout')
  .set('Authorization', `Bearer ${token}`);

expect(res.status).toBe(200);

// Verify token is revoked
const res2 = await request(app)
  .get('/api/auth/me')
  .set('Authorization', `Bearer ${token}`);

expect(res2.status).toBe(401);
```

---

## Webhook Signature Verification

### Overview

HMAC-SHA256 signature verification for webhook endpoints to prevent unauthorized access and replay attacks.

### Features

- **HMAC-SHA256 Signatures**: Cryptographic verification
- **Timestamp Validation**: Prevent replay attacks (5-minute window)
- **Timing-Safe Comparison**: Prevent timing attacks
- **Automatic Middleware**: Applied to all webhook routes

### Configuration

```env
# Generate with: openssl rand -hex 64
WEBHOOK_SECRET=your-64-character-hex-webhook-secret

# Skip verification in development (NOT for production)
SKIP_WEBHOOK_VERIFICATION=false
```

### Usage

#### Sending Webhooks

```javascript
const crypto = require('crypto');

const payload = {
  transaction_hash: '0xabc123',
  payment_id: 'pay_123',
  status: 'confirmed'
};

const timestamp = Math.floor(Date.now() / 1000);
const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(signaturePayload)
  .digest('hex');

// Send request
fetch('https://api.cryptons.com/api/webhooks/payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': `sha256=${signature}`,
    'X-Timestamp': timestamp.toString()
  },
  body: JSON.stringify(payload)
});
```

#### Webhook Endpoints

- `POST /api/webhooks/payment` - Payment updates
- `POST /api/webhooks/transaction` - Transaction confirmations
- `POST /api/webhooks/blockchain` - Blockchain events

### Security Properties

- **Replay Attack Prevention**: 5-minute timestamp window
- **Signature Verification**: HMAC-SHA256 with secret key
- **Timing-Safe Comparison**: Prevents timing attacks
- **Automatic Rejection**: Invalid signatures immediately rejected

---

## Database Field Encryption

### Overview

AES-256-GCM encryption for sensitive database fields with authentication.

### Features

- **AES-256-GCM**: Modern authenticated encryption
- **Random IV**: Each encryption uses unique initialization vector
- **Field-Level Encryption**: Encrypt specific object fields
- **Key Generation**: Utility for generating secure keys

### Configuration

```env
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
FIELD_ENCRYPTION_KEY=your-64-character-hex-encryption-key
```

### Usage

#### Encrypt/Decrypt Single Value

```javascript
const { encrypt, decrypt } = require('./utils/encryption');

// Encrypt
const encrypted = encrypt('sensitive data');
console.log(encrypted); // Hex string

// Decrypt
const decrypted = decrypt(encrypted);
console.log(decrypted); // 'sensitive data'
```

#### Encrypt/Decrypt Object Fields

```javascript
const { encryptFields, decryptFields } = require('./utils/encryption');

const user = {
  name: 'John Doe',
  email: 'john@example.com',
  ssn: '123-45-6789',
  publicData: 'visible'
};

// Encrypt sensitive fields
const encrypted = encryptFields(user, ['email', 'ssn']);
// email and ssn are now encrypted, name and publicData remain plain

// Decrypt fields
const decrypted = decryptFields(encrypted, ['email', 'ssn']);
// All fields restored to original values
```

#### One-Way Hashing

```javascript
const { hash } = require('./utils/encryption');

const hashed = hash('sensitive data');
// Use for comparison, cannot be decrypted
```

### Key Management

**Development**:
```bash
# Generate new key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Production**:
- Store in environment variable or secrets manager (Vault, AWS Secrets Manager)
- Rotate keys periodically
- Use different keys per environment

### Best Practices

1. **Never commit encryption keys** to version control
2. **Rotate keys regularly** (every 90 days minimum)
3. **Use different keys** for dev/staging/production
4. **Encrypt at application level** before saving to database
5. **Consider key versioning** for key rotation

---

## Production CORS Configuration

### Overview

Environment-specific CORS policies with strict origin whitelisting for production.

### Features

- **Environment-Specific Origins**: Different origins per environment
- **No Wildcards**: Strict whitelisting in production
- **Configurable**: Override via environment variable
- **Preflight Support**: Proper OPTIONS handling

### Configuration

```env
# Production
ALLOWED_ORIGINS=https://cryptons.com,https://www.cryptons.com,https://app.cryptons.com

# Staging
ALLOWED_ORIGINS=https://staging.cryptons.com,https://staging-app.cryptons.com

# Development (default)
# http://localhost:3000,http://localhost:3001,http://localhost:8080

# CORS settings
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400
```

### Default Origins by Environment

**Production**:
- `https://cryptons.com`
- `https://www.cryptons.com`
- `https://app.cryptons.com`

**Staging**:
- `https://staging.cryptons.com`
- `https://staging-app.cryptons.com`

**Development**:
- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:8080`

### CORS Security Features

- ✅ No wildcard origins in production
- ✅ HTTPS-only in production
- ✅ Credentials support (cookies, auth headers)
- ✅ Preflight caching (24 hours)
- ✅ Specific allowed methods and headers

---

## Secrets Management

### Overview

Runtime validation and strength checking for critical application secrets.

### Features

- **Strength Validation**: Check length, entropy, defaults
- **Runtime Checks**: Validate on application startup
- **Security Summary**: Get overview of security configuration
- **Production Enforcement**: Fail startup if critical secrets invalid

### Configuration

```env
# Critical Secrets (Required in production)
JWT_SECRET=minimum-32-characters-with-high-entropy
JWT_REFRESH_SECRET=minimum-32-characters-with-high-entropy
MONGODB_URI=mongodb://user:pass@host:27017/db

# Recommended Secrets
WEBHOOK_SECRET=64-character-hex-string
FIELD_ENCRYPTION_KEY=64-character-hex-string
REDIS_PASSWORD=strong-random-password
```

### Secret Requirements

**Length**: Minimum 32 characters  
**Entropy**: At least 10 unique characters  
**No Defaults**: Must not contain default/example values

### Usage

#### Manual Validation

```javascript
const { validateSecrets } = require('./utils/secretsValidation');

const results = validateSecrets();
console.log(results);
// {
//   valid: true/false,
//   errors: [],
//   warnings: [],
//   environment: 'production'
// }
```

#### Get Security Summary

```javascript
const { getSecuritySummary } = require('./utils/secretsValidation');

const summary = getSecuritySummary();
console.log(summary);
// {
//   environment: 'production',
//   jwtConfigured: true,
//   webhookSecurityEnabled: true,
//   redisEnabled: true,
//   encryptionEnabled: true,
//   mongoAuth: true,
//   mongoTLS: true,
//   corsConfigured: true,
//   productionReady: true
// }
```

### Secret Generation

```bash
# JWT Secrets (32+ characters)
openssl rand -hex 32

# Webhook Secret (64 characters)
openssl rand -hex 64

# Encryption Key (64 characters)
openssl rand -hex 32
```

---

## Audit Logging

### Overview

Dedicated audit logging for security-sensitive operations with structured JSON format.

### Features

- **Dedicated Log File**: Separate from application logs
- **JSON Format**: Structured, parsable logs
- **Event Types**: Predefined audit event categories
- **Automatic Logging**: Integrated into auth and admin operations

### Log Location

```
logs/audit.log
```

### Logged Events

- **Authentication**: Login, logout, registration, password changes
- **Authorization**: Access denied, unauthorized attempts
- **Admin Actions**: All admin operations
- **Security Events**: Rate limits, suspicious activity
- **Payments**: Payment confirmations, failures
- **Multi-sig**: Wallet operations, approvals

### Usage

```javascript
const { logAuditEvent, AUDIT_EVENTS } = require('./utils/auditLogger');

// Log custom event
logAuditEvent(AUDIT_EVENTS.ADMIN_ACTION, {
  adminId: user.id,
  action: 'delete_product',
  target: { productId: product.id },
  ip: req.ip
});
```

### Log Format

```json
{
  "event": "user.login",
  "timestamp": "2025-10-05T12:34:56.789Z",
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "success": true,
  "service": "cryptons-audit"
}
```

---

## Enhanced Error Handling

### Overview

Secure error handling that prevents information leakage while providing useful feedback.

### Features

- **Message Sanitization**: Remove sensitive information from errors
- **Context Logging**: Log errors with request context
- **Security Event Logging**: Audit unauthorized access attempts
- **Environment-Aware**: Detailed errors in dev, sanitized in production

### Security Enhancements

1. **Sensitive Pattern Detection**: Removes patterns like "password", "secret", "token"
2. **Length Limiting**: Truncates verbose error messages
3. **Generic Fallbacks**: Uses generic messages for sensitive errors
4. **Audit Integration**: Logs security-related errors

### Production Error Response

```json
{
  "success": false,
  "status": "error",
  "message": "An error occurred. Please try again later."
}
```

### Development Error Response

```json
{
  "success": false,
  "status": "error",
  "error": { /* full error object */ },
  "message": "Detailed error message",
  "stack": "Error stack trace"
}
```

---

## Security Headers

### Overview

Enhanced security headers using Helmet.js with strict configuration.

### Headers Configured

- **Content-Security-Policy**: Restrict resource loading
- **Strict-Transport-Security**: Force HTTPS (1 year)
- **X-Content-Type-Options**: Prevent MIME sniffing
- **X-Frame-Options**: Prevent clickjacking
- **X-XSS-Protection**: Enable XSS filter
- **Referrer-Policy**: Control referrer information
- **Hide X-Powered-By**: Remove server fingerprinting

### Configuration

Headers are automatically applied via middleware in `src/app.js`.

---

## Production Deployment Checklist

Before deploying to production, ensure:

- [ ] Redis enabled and configured (`REDIS_ENABLED=true`)
- [ ] All critical secrets set with strong values
- [ ] CORS configured with specific origins (no wildcards)
- [ ] Webhook secret generated and configured
- [ ] Field encryption key generated
- [ ] MongoDB authentication enabled
- [ ] MongoDB TLS/SSL enabled
- [ ] Audit logging directory writable
- [ ] Rate limits configured appropriately
- [ ] Error logging configured (Sentry, etc.)
- [ ] Security headers enabled
- [ ] Secrets validation passes

### Verification

```bash
# Check security configuration
curl http://localhost:3000/api/health

# Verify CORS
curl -H "Origin: https://cryptons.com" http://localhost:3000/api/health

# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Test logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <token>"
```

---

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Rate Limit Events**: Track in audit log
2. **Failed Authentication**: Monitor for brute force
3. **Redis Availability**: Alert if token revocation fails
4. **Webhook Failures**: Track signature verification failures
5. **Encryption Errors**: Alert on encryption/decryption failures

### Log Analysis

```bash
# View audit logs
tail -f logs/audit.log | jq

# Count authentication events
grep "user.login" logs/audit.log | wc -l

# Find rate limit violations
grep "rate_limit_exceeded" logs/audit.log

# Find unauthorized attempts
grep "unauthorized_attempt" logs/audit.log
```

---

## Troubleshooting

### Redis Connection Issues

**Problem**: Token revocation not working  
**Solution**: Check Redis connection and credentials

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 -a <password> ping
```

### Webhook Verification Failures

**Problem**: Valid webhooks being rejected  
**Solution**: Check timestamp and signature generation

```javascript
// Verify signature generation
const crypto = require('crypto');
const timestamp = Math.floor(Date.now() / 1000);
const payload = JSON.stringify(data);
const signature = crypto
  .createHmac('sha256', process.env.WEBHOOK_SECRET)
  .update(`${timestamp}.${payload}`)
  .digest('hex');
```

### CORS Errors

**Problem**: Browser blocking requests  
**Solution**: Verify origin in allowed list

```bash
# Check CORS configuration
echo $ALLOWED_ORIGINS
```

---

## Security Best Practices

1. **Never commit secrets** to version control
2. **Rotate secrets regularly** (every 90 days)
3. **Use different secrets** per environment
4. **Monitor audit logs** for suspicious activity
5. **Enable TLS/SSL** in production
6. **Use strong passwords** for all services
7. **Keep dependencies updated** (`npm audit`)
8. **Regular security audits** (automated and manual)
9. **Implement 2FA** for admin accounts
10. **Use secrets management** (Vault, AWS Secrets Manager)

---

## Support and Maintenance

### Getting Help

- Check logs: `logs/combined.log`, `logs/audit.log`, `logs/error.log`
- Review documentation in `/docs` directory
- Check environment configuration in `.env.example`

### Updates and Patches

Security features are continuously improved. Check for updates:

```bash
npm update
npm audit fix
```

---

## License

MIT License - See LICENSE file for details

## Contributors

- Cryptons.com Security Team
- Community Contributors

---

**Last Updated**: 2025-10-05  
**Version**: 1.0.0
