# Production CORS Configuration Guide

**Status**: ⚠️ NEEDS IMPROVEMENT  
**Priority**: HIGH  
**CVSS Score**: 4.3 (MEDIUM)  
**Timeline**: 1 week

---

## Overview

Currently, CORS (Cross-Origin Resource Sharing) is configured to allow all origins (`*`), which is insecure for production environments. This guide provides proper CORS configuration for different environments.

## Problem Statement

**Current Configuration:**
```javascript
// src/app.js
app.use(cors()); // Allows ALL origins - INSECURE
```

**Security Risks:**
- Any website can make requests to your API
- CSRF attacks possible
- Credentials theft via malicious sites
- Data exfiltration
- API abuse from unauthorized origins

**Impact:**
- Unauthorized API access
- Potential data breaches
- Cross-site scripting attacks
- Session hijacking

## Recommended Solution: Environment-Specific CORS

### Architecture

```
Development:
┌─────────────┐
│ localhost:  │──✅ Allowed
│ 3000, 3001  │
└─────────────┘

Staging:
┌─────────────────────┐
│ staging.cryptons.com │──✅ Allowed
└─────────────────────┘

Production:
┌───────────────┐
│ cryptons.com  │──✅ Allowed
│ www.cryptons  │──✅ Allowed
│ .com          │
└───────────────┘
┌───────────────┐
│ evil.com      │──❌ Blocked
└───────────────┘
```

### Implementation Steps

#### 1. Update Environment Variables

Add to `.env`:

```env
# CORS Configuration
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400
```

Update `.env.example`:

```env
# CORS Configuration (CRITICAL for production)
NODE_ENV=production
ALLOWED_ORIGINS=https://cryptons.com,https://www.cryptons.com,https://app.cryptons.com
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400
```

Environment-specific examples:

**Development (`.env.development`):**
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
```

**Staging (`.env.staging`):**
```env
ALLOWED_ORIGINS=https://staging.cryptons.com,https://staging-app.cryptons.com
```

**Production (`.env.production`):**
```env
ALLOWED_ORIGINS=https://cryptons.com,https://www.cryptons.com,https://app.cryptons.com
```

#### 2. Create CORS Configuration Module

Create `src/config/cors.js`:

```javascript
const logger = require('../utils/logger');

/**
 * Get allowed origins based on environment
 * @returns {Array|string|function} - Allowed origins configuration
 */
const getAllowedOrigins = () => {
  const env = process.env.NODE_ENV || 'development';
  
  // Get origins from environment variable
  const envOrigins = process.env.ALLOWED_ORIGINS;
  
  if (envOrigins) {
    // Split comma-separated origins
    const origins = envOrigins.split(',').map(origin => origin.trim());
    logger.info(`CORS allowed origins: ${origins.join(', ')}`);
    return origins;
  }
  
  // Default origins by environment
  switch (env) {
    case 'production':
      return [
        'https://cryptons.com',
        'https://www.cryptons.com',
        'https://app.cryptons.com'
      ];
    
    case 'staging':
      return [
        'https://staging.cryptons.com',
        'https://staging-app.cryptons.com'
      ];
    
    case 'development':
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
      ];
    
    case 'test':
      return '*'; // Allow all for testing
    
    default:
      logger.warn(`Unknown environment: ${env}, defaulting to development CORS`);
      return [
        'http://localhost:3000',
        'http://localhost:3001'
      ];
  }
};

/**
 * CORS options configuration
 */
const corsOptions = {
  // Origin validation
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (allowedOrigins === '*' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Check for dynamic subdomain patterns
      const isDynamicOriginAllowed = allowedOrigins.some(allowed => {
        if (allowed.includes('*')) {
          const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
          return pattern.test(origin);
        }
        return false;
      });
      
      if (isDynamicOriginAllowed) {
        callback(null, true);
      } else {
        logger.warn(`CORS request blocked from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  
  // Allow credentials (cookies, authorization headers)
  credentials: process.env.CORS_CREDENTIALS === 'true',
  
  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  
  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'Accept',
    'Accept-Language',
    'Content-Language'
  ],
  
  // Exposed headers (accessible to client JavaScript)
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  
  // Preflight request cache duration (24 hours)
  maxAge: parseInt(process.env.CORS_MAX_AGE) || 86400,
  
  // Enable pre-flight OPTIONS request
  preflightContinue: false,
  
  // Provide successful OPTIONS status
  optionsSuccessStatus: 204
};

module.exports = {
  corsOptions,
  getAllowedOrigins
};
```

#### 3. Update Application Configuration

Update `src/app.js`:

```javascript
const express = require('express');
const cors = require('cors');
const { corsOptions } = require('./config/cors');
const logger = require('./utils/logger');

const app = express();

// Apply CORS middleware with configuration
app.use(cors(corsOptions));

// Log CORS configuration on startup
const { getAllowedOrigins } = require('./config/cors');
logger.info('CORS Configuration:', {
  environment: process.env.NODE_ENV,
  allowedOrigins: getAllowedOrigins(),
  credentials: corsOptions.credentials
});

// CORS error handler
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    logger.warn('CORS violation:', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    
    return res.status(403).json({
      success: false,
      error: 'CORS policy: Origin not allowed',
      message: 'Your origin is not allowed to access this resource'
    });
  }
  
  next(err);
});

// Rest of your middleware and routes...
```

#### 4. Advanced CORS Configuration

For more complex scenarios:

```javascript
// src/config/cors.advanced.js
const { corsOptions: baseCorsOptions } = require('./cors');

/**
 * Route-specific CORS configuration
 */
const routeSpecificCors = {
  // Public API - more permissive
  '/api/public': {
    origin: '*',
    methods: ['GET'],
    credentials: false
  },
  
  // Webhook endpoints - specific providers
  '/api/webhooks': {
    origin: [
      'https://btcpay.server',
      'https://blockchain.info',
      'https://payments.stripe.com'
    ],
    methods: ['POST'],
    credentials: false
  },
  
  // Admin endpoints - restricted
  '/api/admin': {
    origin: process.env.ADMIN_ALLOWED_ORIGINS?.split(',') || ['https://admin.cryptons.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
};

/**
 * Get CORS options for specific route
 * @param {string} path - Request path
 * @returns {object} - CORS options
 */
const getCorsOptionsForRoute = (path) => {
  for (const [route, options] of Object.entries(routeSpecificCors)) {
    if (path.startsWith(route)) {
      return { ...baseCorsOptions, ...options };
    }
  }
  return baseCorsOptions;
};

module.exports = {
  routeSpecificCors,
  getCorsOptionsForRoute
};
```

Apply route-specific CORS:

```javascript
const { getCorsOptionsForRoute } = require('./config/cors.advanced');

// Dynamic CORS based on route
app.use((req, res, next) => {
  const corsOpts = getCorsOptionsForRoute(req.path);
  cors(corsOpts)(req, res, next);
});
```

#### 5. CORS Preflight Handling

Handle OPTIONS requests properly:

```javascript
// Explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));

// Or route-specific
app.options('/api/*', cors(corsOptions));
```

#### 6. Security Headers Integration

Combine with other security headers:

```javascript
const helmet = require('helmet');

// Apply security headers
app.use(helmet({
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", ...getAllowedOrigins()],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

// Then apply CORS
app.use(cors(corsOptions));
```

### Testing

#### Unit Tests

Create `tests/cors.test.js`:

```javascript
const request = require('supertest');
const app = require('../src/app');

describe('CORS Configuration', () => {
  it('should allow requests from allowed origin', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://cryptons.com')
      .expect(200);
    
    expect(response.headers['access-control-allow-origin']).toBe('https://cryptons.com');
  });
  
  it('should block requests from disallowed origin', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.com')
      .expect(403);
    
    expect(response.body.error).toContain('CORS');
  });
  
  it('should handle preflight OPTIONS request', async () => {
    const response = await request(app)
      .options('/api/users')
      .set('Origin', 'https://cryptons.com')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });
  
  it('should include credentials header when configured', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Origin', 'https://cryptons.com')
      .expect(200);
    
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
```

#### Manual Testing

```bash
# Test CORS with curl

# Allowed origin (should succeed)
curl -H "Origin: https://cryptons.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:3000/api/health

# Disallowed origin (should fail)
curl -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:3000/api/health

# With credentials
curl -H "Origin: https://cryptons.com" \
     -H "Cookie: session=abc123" \
     http://localhost:3000/api/auth/me
```

#### Browser Testing

```javascript
// Test in browser console (on allowed domain)
fetch('https://api.cryptons.com/api/health', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log('✅ CORS working:', data))
.catch(error => console.error('❌ CORS error:', error));
```

### Monitoring

```javascript
// Monitor CORS violations
const corsViolations = {
  count: 0,
  origins: {}
};

// In CORS error handler
if (err.message === 'Not allowed by CORS') {
  corsViolations.count++;
  const origin = req.headers.origin;
  
  if (!corsViolations.origins[origin]) {
    corsViolations.origins[origin] = 0;
  }
  corsViolations.origins[origin]++;
  
  // Alert if too many violations
  if (corsViolations.count > 100) {
    logger.error('High number of CORS violations detected', corsViolations);
    // Send alert to security team
  }
}

// Metrics endpoint (admin only)
app.get('/api/admin/metrics/cors', (req, res) => {
  res.json({
    totalViolations: corsViolations.count,
    violationsByOrigin: corsViolations.origins
  });
});
```

### Common Issues and Solutions

#### Issue 1: Wildcard with Credentials

**Problem:**
```javascript
// This DOESN'T work
origin: '*',
credentials: true
```

**Solution:**
```javascript
// Must specify explicit origins when using credentials
origin: ['https://cryptons.com'],
credentials: true
```

#### Issue 2: Missing Preflight Headers

**Problem:** Browser sends OPTIONS request but gets 404

**Solution:**
```javascript
// Add explicit OPTIONS handler before routes
app.options('*', cors(corsOptions));
```

#### Issue 3: Cookie Not Sent

**Problem:** Cookie not included in cross-origin request

**Solution:**
```javascript
// Server: Allow credentials
credentials: true

// Client: Include credentials
fetch('https://api.cryptons.com/endpoint', {
  credentials: 'include'  // Important!
})
```

#### Issue 4: Custom Headers Not Received

**Problem:** Custom headers stripped by CORS

**Solution:**
```javascript
// Expose custom headers
exposedHeaders: ['X-Custom-Header', 'X-Total-Count']
```

### Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` with production domains only
- [ ] Enable `credentials: true` only if needed
- [ ] Remove wildcard (`*`) origins
- [ ] Test all CORS scenarios
- [ ] Set appropriate `maxAge` for preflight cache
- [ ] Enable CORS monitoring
- [ ] Configure CDN CORS if using CDN
- [ ] Document allowed origins
- [ ] Set up alerts for CORS violations

### Docker Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    environment:
      - NODE_ENV=production
      - ALLOWED_ORIGINS=https://cryptons.com,https://www.cryptons.com
      - CORS_CREDENTIALS=true
      - CORS_MAX_AGE=86400
```

### Kubernetes Configuration

```yaml
# kubernetes/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cryptons-api
spec:
  template:
    spec:
      containers:
      - name: api
        env:
        - name: NODE_ENV
          value: "production"
        - name: ALLOWED_ORIGINS
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: allowed-origins
        - name: CORS_CREDENTIALS
          value: "true"
```

### CDN/Proxy Configuration

#### Nginx

```nginx
# nginx.conf
location /api/ {
    # CORS headers (if not handled by application)
    add_header 'Access-Control-Allow-Origin' 'https://cryptons.com' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    # Handle preflight
    if ($request_method = 'OPTIONS') {
        return 204;
    }
    
    proxy_pass http://api:3000;
}
```

#### CloudFlare

```javascript
// CloudFlare Worker for CORS
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const allowedOrigins = [
    'https://cryptons.com',
    'https://www.cryptons.com'
  ];
  
  const origin = request.headers.get('Origin');
  
  if (allowedOrigins.includes(origin)) {
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    
    newResponse.headers.set('Access-Control-Allow-Origin', origin);
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return newResponse;
  }
  
  return new Response('Forbidden', { status: 403 });
}
```

## Success Criteria

- ✅ CORS configured with explicit origins
- ✅ Wildcard removed from production
- ✅ Preflight requests handled properly
- ✅ Credentials working when needed
- ✅ All tests passing
- ✅ Monitoring in place
- ✅ Documentation updated
- ✅ Zero CORS-related security incidents

---

**Status**: Implementation Required  
**Owner**: Backend Team  
**Priority**: HIGH  
**Estimated Effort**: 15-25 hours
