const request = require('supertest');
const { getAllowedOrigins, getCorsOptions } = require('../src/config/cors');

describe('CORS Configuration', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalOrigins = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
    process.env.ALLOWED_ORIGINS = originalOrigins;
  });

  describe('getAllowedOrigins', () => {
    it('should return empty array in production when ALLOWED_ORIGINS is not set', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOWED_ORIGINS;

      const origins = getAllowedOrigins();
      
      // In production, ALLOWED_ORIGINS must be explicitly set
      expect(Array.isArray(origins)).toBe(true);
      expect(origins.length).toBe(0);
    });

    it('should use ALLOWED_ORIGINS in production when set', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://cryptons.com,https://www.cryptons.com,https://app.cryptons.com';

      const origins = getAllowedOrigins();
      
      expect(origins).toContain('https://cryptons.com');
      expect(origins).toContain('https://www.cryptons.com');
      expect(origins).toContain('https://app.cryptons.com');
      expect(origins).not.toContain('http://localhost:3000');
    });

    it('should return staging origins in staging', () => {
      process.env.NODE_ENV = 'staging';
      delete process.env.ALLOWED_ORIGINS;

      const origins = getAllowedOrigins();
      
      expect(origins).toContain('https://staging.cryptons.com');
      expect(origins).toContain('https://staging-app.cryptons.com');
    });

    it('should return development origins in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOWED_ORIGINS;

      const origins = getAllowedOrigins();
      
      expect(origins).toContain('http://localhost:3000');
      expect(origins).toContain('http://localhost:3001');
    });

    it('should use ALLOWED_ORIGINS env variable when set in any environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://custom1.com,https://custom2.com';

      const origins = getAllowedOrigins();
      
      expect(origins).toContain('https://custom1.com');
      expect(origins).toContain('https://custom2.com');
      expect(origins.length).toBe(2);
    });

    it('should handle ALLOWED_ORIGINS with whitespace', () => {
      process.env.ALLOWED_ORIGINS = ' https://example1.com , https://example2.com ';

      const origins = getAllowedOrigins();
      
      expect(origins).toContain('https://example1.com');
      expect(origins).toContain('https://example2.com');
    });
  });

  describe('CORS Integration', () => {
    let app;

    beforeEach(() => {
      // Clear require cache to reload app with fresh environment
      delete require.cache[require.resolve('../src/app')];
      delete require.cache[require.resolve('../src/config/cors')];
    });

    it('should allow localhost origins in test environment', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.ALLOWED_ORIGINS;
      
      // Reload app with test environment
      app = require('../src/app');
      
      const testOrigin = 'http://localhost:3000';
      const res = await request(app)
        .get('/api/health')
        .set('Origin', testOrigin);

      // In test environment, localhost should be allowed
      expect([200, 503]).toContain(res.statusCode); // 503 if services are down
      if (res.statusCode !== 500) {
        expect(res.headers).toHaveProperty('access-control-allow-origin');
      }
    });

    it('should handle preflight OPTIONS request in test environment', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.ALLOWED_ORIGINS;
      
      // Reload app with test environment
      app = require('../src/app');
      
      const testOrigin = 'http://localhost:3000';
      const res = await request(app)
        .options('/api/auth/login')
        .set('Origin', testOrigin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      // Should be successful in test mode
      expect([200, 204]).toContain(res.statusCode);
    });
  });

  describe('Security', () => {
    it('should not use wildcard origin in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://cryptons.com,https://www.cryptons.com';

      const origins = getAllowedOrigins();
      
      expect(origins).not.toContain('*');
      expect(Array.isArray(origins)).toBe(true);
    });

    it('should require ALLOWED_ORIGINS in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOWED_ORIGINS;

      const origins = getAllowedOrigins();
      
      expect(Array.isArray(origins)).toBe(true);
      expect(origins.length).toBe(0);
    });

    it('should have specific allowed origins in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOWED_ORIGINS;

      const origins = getAllowedOrigins();
      
      expect(Array.isArray(origins)).toBe(true);
      expect(origins.length).toBeGreaterThan(0);
    });
  });

  describe('getCorsOptions', () => {
    it('should always have credentials set to true', () => {
      process.env.NODE_ENV = 'production';
      const options = getCorsOptions();
      
      expect(options.credentials).toBe(true);
    });

    it('should specify allowed methods', () => {
      const options = getCorsOptions();
      
      expect(options.methods).toBeDefined();
      expect(Array.isArray(options.methods)).toBe(true);
      expect(options.methods).toContain('GET');
      expect(options.methods).toContain('POST');
      expect(options.methods).toContain('PUT');
      expect(options.methods).toContain('DELETE');
      expect(options.methods).toContain('PATCH');
      expect(options.methods).toContain('OPTIONS');
    });

    it('should specify allowed headers', () => {
      const options = getCorsOptions();
      
      expect(options.allowedHeaders).toBeDefined();
      expect(Array.isArray(options.allowedHeaders)).toBe(true);
      expect(options.allowedHeaders).toContain('Content-Type');
      expect(options.allowedHeaders).toContain('Authorization');
      expect(options.allowedHeaders).toContain('X-Requested-With');
    });

    it('should have different maxAge for production vs development', () => {
      process.env.NODE_ENV = 'production';
      const prodOptions = getCorsOptions();
      
      process.env.NODE_ENV = 'development';
      const devOptions = getCorsOptions();
      
      expect(prodOptions.maxAge).toBe(86400);
      expect(devOptions.maxAge).toBe(600);
    });
  });
});
