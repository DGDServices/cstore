const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const tokenBlacklist = require('../src/utils/tokenBlacklist');
const { generateToken } = require('../src/utils/jwt');

describe('JWT Token Revocation', () => {
  let user;
  let token;

  beforeEach(async () => {
    if (!global.isConnected()) {
      console.log('Skipping test: Database not connected');
      return;
    }

    // Create test user
    user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });

    // Generate token
    token = generateToken(user._id);
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user and revoke token', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out');
    });

    it('should not allow using revoked token', async () => {
      if (!global.isConnected()) return;

      // Logout (revoke token)
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send();

      // Try to use revoked token
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/auth/logout')
        .send();

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should revoke all user tokens', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('all devices');
    });

    it('should not allow using any token after logout-all', async () => {
      if (!global.isConnected()) return;

      // Create second token for same user
      const token2 = generateToken(user._id);

      // Logout from all devices
      await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${token}`)
        .send();

      // Try to use first token
      const res1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(res1.statusCode).toBe(401);

      // Try to use second token
      const res2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token2}`)
        .send();

      expect(res2.statusCode).toBe(401);
    });
  });

  describe('PUT /api/auth/password', () => {
    it('should revoke all tokens on password change', async () => {
      if (!global.isConnected()) return;

      // Change password
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newPassword123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();

      // Old token should not work
      const res2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(res2.statusCode).toBe(401);

      // New token should work
      const newToken = res.body.data.token;
      const res3 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newToken}`)
        .send();

      expect(res3.statusCode).toBe(200);
    });
  });

  describe('Token Blacklist Utility', () => {
    it('should handle token blacklist operations when Redis unavailable', async () => {
      if (!global.isConnected()) return;

      // These should not throw errors even if Redis is unavailable
      const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
      expect(typeof isBlacklisted).toBe('boolean');

      const added = await tokenBlacklist.addToBlacklist(token);
      expect(typeof added).toBe('boolean');
    });


    });
  });
});
