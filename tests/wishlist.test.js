const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Wishlist = require('../src/models/Wishlist');
const { generateToken } = require('../src/utils/jwt');

describe('Wishlist API Tests', () => {
  let userToken;
  let testUser;
  let testProduct;
  let adminToken;

  beforeAll(async () => {
    if (!global.isConnected()) return;

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'wishlist-user@test.com',
      password: 'password123'
    });
    userToken = generateToken(testUser._id);

    // Create admin user for product creation
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'wishlist-admin@test.com',
      password: 'password123',
      role: 'admin'
    });
    adminToken = generateToken(adminUser._id);

    // Create test product
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'This is a test product for wishlist testing',
      price: 0.01,
      priceUSD: 500,
      stock: 10,
      currency: 'BTC',
      isActive: true
    });
  });

  afterAll(async () => {
    if (!global.isConnected()) return;
    
    await Wishlist.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
  });

  describe('GET /api/wishlist', () => {
    it('should get empty wishlist for new user', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/wishlist')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/wishlist');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/wishlist/items', () => {
    beforeEach(async () => {
      if (!global.isConnected()) return;
      await Wishlist.deleteMany({ user: testUser._id });
    });

    it('should add item to wishlist', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/wishlist/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: testProduct._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].product._id).toBe(testProduct._id.toString());
    });

    it('should not add duplicate item to wishlist', async () => {
      if (!global.isConnected()) return;

      // Add item first time
      await request(app)
        .post('/api/wishlist/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: testProduct._id.toString() });

      // Try to add again
      const res = await request(app)
        .post('/api/wishlist/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: testProduct._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Product already in wishlist');
    });

    it('should return 404 for non-existent product', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/wishlist/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: '507f1f77bcf86cd799439011' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/wishlist/items')
        .send({ productId: testProduct._id.toString() });

      expect(res.status).toBe(401);
    });

    it('should require productId', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/wishlist/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/wishlist/items/:productId', () => {
    beforeEach(async () => {
      if (!global.isConnected()) return;
      
      // Add item to wishlist
      await Wishlist.deleteMany({ user: testUser._id });
      await request(app)
        .post('/api/wishlist/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: testProduct._id.toString() });
    });

    it('should remove item from wishlist', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .delete(`/api/wishlist/items/${testProduct._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .delete(`/api/wishlist/items/${testProduct._id}`);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/wishlist', () => {
    beforeEach(async () => {
      if (!global.isConnected()) return;
      
      // Add item to wishlist
      await Wishlist.deleteMany({ user: testUser._id });
      await request(app)
        .post('/api/wishlist/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: testProduct._id.toString() });
    });

    it('should clear entire wishlist', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .delete('/api/wishlist')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .delete('/api/wishlist');

      expect(res.status).toBe(401);
    });
  });
});
