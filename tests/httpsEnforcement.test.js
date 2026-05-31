const {
  forceHttps,
  addHstsHeader,
  enforceHttps,
  requireHttps,
  secureSessionCookies,
  getHttpsStatus
} = require('../src/middleware/httpsEnforcement');

describe('HTTPS Enforcement Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      secure: false,
      hostname: 'example.com',
      url: '/test',
      headers: {}
    };
    res = {
      redirect: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn()
    };
    next = jest.fn();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.FORCE_HTTPS;
    delete process.env.HSTS_MAX_AGE;
    delete process.env.HSTS_INCLUDE_SUBDOMAINS;
    delete process.env.HSTS_PRELOAD;
  });

  describe('forceHttps', () => {
    it('should skip redirect in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.FORCE_HTTPS = 'true';

      forceHttps(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should skip redirect when FORCE_HTTPS is not enabled', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'false';

      forceHttps(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should redirect HTTP to HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      req.secure = false;

      forceHttps(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith(301, 'https://example.com/test');
      expect(next).not.toHaveBeenCalled();
    });

    it('should not redirect if already secure', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      req.secure = true;

      forceHttps(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should recognize x-forwarded-proto header', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      req.headers['x-forwarded-proto'] = 'https';

      forceHttps(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should recognize x-forwarded-ssl header', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      req.headers['x-forwarded-ssl'] = 'on';

      forceHttps(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('addHstsHeader', () => {
    it('should not add HSTS header in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.FORCE_HTTPS = 'true';

      addHstsHeader(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should add HSTS header in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';

      addHstsHeader(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('max-age=')
      );
      expect(next).toHaveBeenCalled();
    });

    it('should use custom max-age', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      process.env.HSTS_MAX_AGE = '7200';

      addHstsHeader(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('max-age=7200')
      );
    });

    it('should include includeSubDomains by default', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';

      addHstsHeader(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('includeSubDomains')
      );
    });

    it('should not include includeSubDomains when disabled', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      process.env.HSTS_INCLUDE_SUBDOMAINS = 'false';

      addHstsHeader(req, res, next);

      const call = res.setHeader.mock.calls[0];
      expect(call[1]).not.toContain('includeSubDomains');
    });

    it('should include preload when enabled', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      process.env.HSTS_PRELOAD = 'true';

      addHstsHeader(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('preload')
      );
    });
  });

  describe('enforceHttps', () => {
    it('should apply both redirect and HSTS', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      req.secure = true;

      enforceHttps(req, res, next);

      expect(res.setHeader).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should redirect before adding HSTS', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      req.secure = false;

      enforceHttps(req, res, next);

      expect(res.redirect).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('requireHttps', () => {
    it('should skip in development', () => {
      process.env.NODE_ENV = 'development';

      requireHttps(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block non-HTTPS requests in production', () => {
      process.env.NODE_ENV = 'production';
      req.secure = false;

      requireHttps(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'HTTPS Required'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow HTTPS requests in production', () => {
      process.env.NODE_ENV = 'production';
      req.secure = true;

      requireHttps(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('secureSessionCookies', () => {
    it('should not modify cookies in development', () => {
      process.env.NODE_ENV = 'development';

      secureSessionCookies(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should make cookies secure in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'true';
      
      const originalCookie = res.cookie;

      secureSessionCookies(req, res, next);

      // Verify cookie function was overridden
      expect(res.cookie).not.toBe(originalCookie);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getHttpsStatus', () => {
    it('should return current HTTPS configuration', () => {
      process.env.FORCE_HTTPS = 'true';
      process.env.NODE_ENV = 'production';
      process.env.HSTS_MAX_AGE = '7200';
      process.env.HSTS_PRELOAD = 'true';

      const status = getHttpsStatus();

      expect(status.enabled).toBe(true);
      expect(status.environment).toBe('production');
      expect(status.hstsMaxAge).toBe(7200);
      expect(status.hstsPreload).toBe(true);
    });

    it('should return defaults when not configured', () => {
      const status = getHttpsStatus();

      expect(status.enabled).toBe(false);
      expect(status.hstsMaxAge).toBe(31536000); // Default 1 year
    });
  });
});
