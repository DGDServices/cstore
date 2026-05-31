# Security Features - Quick Start Guide

Get up and running with the new security features in 5 minutes.

## 1. Generate Secrets

```bash
# JWT Secrets (32+ chars each)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# Webhook Secret (64 chars)
WEBHOOK_SECRET=$(openssl rand -hex 64)

# Encryption Key (64 chars)
FIELD_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Display secrets
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "WEBHOOK_SECRET=$WEBHOOK_SECRET"
echo "FIELD_ENCRYPTION_KEY=$FIELD_ENCRYPTION_KEY"
```

## 2. Configure Environment

Add to your `.env` file:

```env
# Copy from .env.example and update these values

# JWT Configuration
JWT_SECRET=<your-jwt-secret>
JWT_REFRESH_SECRET=<your-refresh-secret>

# Redis (for token revocation)
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=<your-redis-password>

# Webhook Security
WEBHOOK_SECRET=<your-webhook-secret>

# Database Encryption
FIELD_ENCRYPTION_KEY=<your-encryption-key>

# CORS (Production)
ALLOWED_ORIGINS=https://cryptons.com,https://www.cryptons.com,https://app.cryptons.com
```

## 3. Install Redis (Optional but Recommended)

### Using Docker

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:alpine redis-server --requirepass yourpassword
```

### Using Package Manager

```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis
brew services start redis

# Windows
# Download from https://github.com/microsoftarchive/redis/releases
```

## 4. Install Dependencies

```bash
npm install
```

## 5. Test the Features

### Start the Server

```bash
npm start
```

### Test Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'

# Login (save the token)
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq -r '.data.token')

# Get user info
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Logout (revoke token)
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Try to use revoked token (should fail)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Test Webhook Security

```bash
# Generate signature
node -e "
const crypto = require('crypto');
const payload = {transaction_hash: '0xabc', status: 'confirmed'};
const timestamp = Math.floor(Date.now() / 1000);
const secret = process.env.WEBHOOK_SECRET;
const sig = crypto.createHmac('sha256', secret)
  .update(\`\${timestamp}.\${JSON.stringify(payload)}\`)
  .digest('hex');
console.log('Signature:', sig);
console.log('Timestamp:', timestamp);
"

# Send webhook (replace SIGNATURE and TIMESTAMP)
curl -X POST http://localhost:3000/api/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=SIGNATURE" \
  -H "X-Timestamp: TIMESTAMP" \
  -d '{
    "transaction_hash": "0xabc",
    "payment_id": "pay_123",
    "status": "confirmed"
  }'
```

### Test Field Encryption

```javascript
// In Node.js REPL
const { encrypt, decrypt } = require('./src/utils/encryption');

// Encrypt
const encrypted = encrypt('my sensitive data');
console.log('Encrypted:', encrypted);

// Decrypt
const decrypted = decrypt(encrypted);
console.log('Decrypted:', decrypted);
```

## 6. Run Tests

```bash
# Run all tests
npm test

# Run specific security tests
npm test -- tests/tokenRevocation.test.js
npm test -- tests/webhookSecurity.test.js
npm test -- tests/encryption.test.js
npm test -- tests/corsConfiguration.test.js
npm test -- tests/secretsValidation.test.js
```

## 7. Check Security Status

```javascript
// In Node.js REPL or script
const { getSecuritySummary } = require('./src/utils/secretsValidation');

console.log(getSecuritySummary());
// Shows security configuration status
```

## Common Issues

### Redis Connection Errors

If you see "Redis not available" warnings:

1. Check Redis is running: `redis-cli ping`
2. Verify Redis URL in `.env`
3. Check Redis password if required
4. Application will work without Redis, but token revocation won't function

### Webhook Verification Failures

If webhooks are rejected:

1. Check `WEBHOOK_SECRET` is set
2. Verify signature generation matches docs
3. Check timestamp is within 5 minutes
4. Can skip verification in dev: `SKIP_WEBHOOK_VERIFICATION=true`

### CORS Errors in Browser

If browser blocks requests:

1. Check `ALLOWED_ORIGINS` includes your domain
2. Verify protocol (http/https) matches
3. Check for trailing slashes in origins
4. In dev, ensure localhost ports are included

## Production Deployment

Before deploying to production:

```bash
# 1. Generate production secrets (different from dev!)
# 2. Configure Redis with password
# 3. Set ALLOWED_ORIGINS to production domains
# 4. Enable MongoDB authentication
# 5. Set NODE_ENV=production

# Verify configuration
node -e "
const { getSecuritySummary } = require('./src/utils/secretsValidation');
console.log(JSON.stringify(getSecuritySummary(), null, 2));
"

# Should show:
# - productionReady: true
# - All security features enabled
```

## Next Steps

1. Read full documentation: `docs/SECURITY_FEATURES.md`
2. Review audit logs: `logs/audit.log`
3. Set up monitoring for security events
4. Configure alerting for rate limits and failed auth
5. Regular security audits: `npm audit`

## Resources

- [Security Features Documentation](./SECURITY_FEATURES.md)
- [JWT Token Revocation](./JWT_TOKEN_REVOCATION.md)
- [Webhook Security](./WEBHOOK_SECURITY.md)
- [CORS Configuration](./CORS_CONFIGURATION.md)
- [Secrets Management](./SECRETS_MANAGEMENT.md)

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review `.env.example` for configuration reference
3. Run tests to verify setup
4. Check GitHub issues

---

**Quick Setup Checklist**:
- [ ] Generate all secrets
- [ ] Update .env file
- [ ] Install Redis (optional)
- [ ] Run `npm install`
- [ ] Test authentication endpoints
- [ ] Run security tests
- [ ] Check security summary
- [ ] Review audit logs
