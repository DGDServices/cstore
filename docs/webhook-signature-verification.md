# Webhook Signature Verification Middleware

## Overview

The `verifyWebhookSignature` middleware provides secure webhook signature verification using HMAC-SHA256 to ensure webhook authenticity and prevent unauthorized webhook calls, replay attacks, and man-in-the-middle attacks.

## Location

The middleware is located in `src/middleware/security.js` and can be imported as follows:

```javascript
const { verifyWebhookSignature } = require('./src/middleware/security');
```

## Features

- **HMAC-SHA256 Signature Verification**: Uses industry-standard HMAC-SHA256 algorithm
- **Timing-Safe Comparison**: Prevents timing attacks using `crypto.timingSafeEqual()`
- **Flexible Header Support**: Supports signatures with or without `sha256=` prefix
- **Comprehensive Error Handling**: Provides detailed error messages and logging
- **Environment-Based Configuration**: Uses `WEBHOOK_SECRET` from environment variables

## Configuration

### Environment Variables

Set the webhook secret in your `.env` file:

```bash
WEBHOOK_SECRET=your-webhook-secret-key-minimum-32-characters
```

**Security Note**: Use a strong, random secret key. Generate one using:

```bash
openssl rand -hex 32
```

## Usage

### Basic Usage

Apply the middleware to your webhook routes:

```javascript
const express = require('express');
const { verifyWebhookSignature } = require('./middleware/security');

const app = express();
app.use(express.json());

// Protected webhook endpoint
app.post('/api/webhooks/payment', verifyWebhookSignature, (req, res) => {
  // Your webhook handler code
  res.json({ success: true, message: 'Webhook received' });
});
```

### Using with Express Router

```javascript
const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../middleware/security');

// Apply to all routes in this router
router.use(verifyWebhookSignature);

router.post('/payment', handlePaymentWebhook);
router.post('/transaction', handleTransactionWebhook);
router.post('/order', handleOrderWebhook);

module.exports = router;
```

## How It Works

### Signature Calculation

The middleware calculates an HMAC-SHA256 signature of the request body:

1. Converts the request body to a JSON string
2. Creates an HMAC using the `WEBHOOK_SECRET`
3. Updates the HMAC with the JSON string
4. Generates a hexadecimal digest

### Signature Verification

1. Extracts the signature from the `X-Webhook-Signature` header
2. Calculates the expected signature using the request body
3. Compares signatures using timing-safe comparison (`crypto.timingSafeEqual()`)
4. Returns 401 if signatures don't match
5. Calls `next()` if verification succeeds

## Client Implementation

### Sending Webhooks

When sending webhooks to your application, clients must include the `X-Webhook-Signature` header:

```javascript
const crypto = require('crypto');

// Webhook payload
const payload = {
  event: 'payment.completed',
  transaction_id: 'txn_123',
  amount: 100
};

// Calculate signature
const rawBody = JSON.stringify(payload);
const hmac = crypto.createHmac('sha256', webhookSecret);
hmac.update(rawBody);
const signature = hmac.digest('hex');

// Send webhook request
fetch('https://your-api.com/api/webhooks/payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature
    // or with prefix: 'X-Webhook-Signature': `sha256=${signature}`
  },
  body: rawBody
});
```

### Example with curl

```bash
# Payload
PAYLOAD='{"event":"payment.completed","transaction_id":"txn_123","amount":100}'

# Calculate signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "your-webhook-secret" | awk '{print $2}')

# Send request
curl -X POST https://your-api.com/api/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## Error Responses

### Missing Signature

**Status Code**: 401 Unauthorized

```json
{
  "success": false,
  "error": "Missing webhook signature"
}
```

### Invalid Signature

**Status Code**: 401 Unauthorized

```json
{
  "success": false,
  "error": "Invalid webhook signature"
}
```

### Configuration Error

**Status Code**: 500 Internal Server Error

```json
{
  "success": false,
  "error": "Webhook verification not configured"
}
```

## Security Considerations

### Timing-Safe Comparison

The middleware uses `crypto.timingSafeEqual()` to prevent timing attacks. This function compares two buffers in constant time, preventing attackers from using timing information to guess valid signatures.

### Secret Key Management

- **Never commit secrets to version control**
- Use environment variables or secrets management systems (HashiCorp Vault, AWS Secrets Manager)
- Rotate webhook secrets regularly
- Use different secrets for different environments

### HTTPS Required

Always use HTTPS in production to prevent man-in-the-middle attacks. Even with signature verification, data transmitted over HTTP can be intercepted.

### Signature Prefix

The middleware accepts signatures with or without the `sha256=` prefix for flexibility:

- `X-Webhook-Signature: abc123...` (without prefix)
- `X-Webhook-Signature: sha256=abc123...` (with prefix)

## Testing

### Unit Tests

See `tests/verifyWebhookSignature.test.js` for comprehensive unit tests.

```bash
npm test -- tests/verifyWebhookSignature.test.js
```

### Integration Tests

See `tests/integration/verifyWebhookSignature.integration.test.js` for integration tests.

```bash
npm test -- tests/integration/verifyWebhookSignature.integration.test.js
```

## Troubleshooting

### Common Issues

#### "Webhook verification not configured"

**Cause**: `WEBHOOK_SECRET` environment variable is not set.

**Solution**: Add `WEBHOOK_SECRET` to your `.env` file.

#### "Invalid webhook signature"

**Possible Causes**:
1. Incorrect secret key used by the client
2. Request body was modified in transit
3. Signature calculated using different payload format
4. Whitespace or encoding issues with the payload

**Solution**: Verify that:
- Client uses the correct webhook secret
- Payload is JSON-stringified exactly as received
- No middleware modifies the request body before verification

#### Buffer Length Mismatch

**Cause**: Signature format is incorrect (not a valid hex string).

**Solution**: Ensure signature is a 64-character hexadecimal string (SHA-256 produces 32 bytes = 64 hex characters).

## Related Documentation

- [Express Middleware Documentation](https://expressjs.com/en/guide/using-middleware.html)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [HMAC Wikipedia](https://en.wikipedia.org/wiki/HMAC)
- [Webhook Security Best Practices](../security/README.md)

## Support

For questions or issues, please:
1. Check this documentation
2. Review test files for examples
3. Open an issue on GitHub
4. Contact the development team
