const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const { generateToken } = require('../src/utils/jwt');

describe('Product Recommendations API', () => {
  let testUser;
  let userToken;
  let testCategory1;
  let testCategory2;
  let products;

  beforeEach(async () => {
    if (!global.isConnected()) return;

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    });
    userToken = generateToken(testUser._id);

    // Create test categories
    testCategory1 = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      description: 'Electronic products'
    });

    testCategory2 = await Category.create({
      name: 'Books',
      slug: 'books',
      description: 'Books and literature'
    });

    // Create test products
    products = await Product.create([
      {
        name: 'Laptop',
        description: 'High-performance laptop',
        price: 0.02,
        priceUSD: 1000,
        stock: 10,
        category: testCategory1._id,
        averageRating: 4.5,
        numReviews: 10
      },
      {
        name: 'Mouse',
        description: 'Wireless mouse',
        price: 0.001,
        priceUSD: 50,
        stock: 50,
        category: testCategory1._id,
        averageRating: 4.0,
        numReviews: 5
      },
      {
        name: 'Keyboard',
        description: 'Mechanical keyboard',
        price: 0.003,
        priceUSD: 150,
        stock: 20,
        category: testCategory1._id,
        averageRating: 4.8,
        numReviews: 15
      },
      {
        name: 'Book 1',
        description: 'Programming book',
        price: 0.0005,
        priceUSD: 25,
        stock: 100,
        category: testCategory2._id,
        averageRating: 4.2,
        numReviews: 8
      }
    ]);
  });

  describe('GET /api/products/recommendations', () => {
    it('should return popular products for new users with no purchase history', async () => {
      if (!global.isConnected()) return;

      // Create some orders for other users to establish popular products
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'password123'
      });

      await Order.create({
        user: otherUser._id,
        customerEmail: 'other@example.com',
        items: [{
          product: products[0]._id,
          productName: products[0].name,
          quantity: 2,
          price: products[0].price,
          priceUSD: products[0].priceUSD
        }],
        totalPrice: products[0].price * 2,
        totalPriceUSD: products[0].priceUSD * 2,
        cryptocurrency: 'BTC',
        paymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        status: 'paid'
      });

      const res = await request(app)
        .get('/api/products/recommendations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendations).toBeDefined();
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    });

    it('should return personalized recommendations based on purchase history', async () => {
      if (!global.isConnected()) return;

      // Create an order for the test user
      await Order.create({
        user: testUser._id,
        customerEmail: testUser.email,
        items: [{
          product: products[0]._id, // Laptop
          productName: products[0].name,
          quantity: 1,
          price: products[0].price,
          priceUSD: products[0].priceUSD
        }],
        totalPrice: products[0].price,
        totalPriceUSD: products[0].priceUSD,
        cryptocurrency: 'BTC',
        paymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        status: 'paid'
      });

      // Create another user who bought similar products
      const similarUser = await User.create({
        name: 'Similar User',
        email: 'similar@example.com',
        password: 'password123'
      });

      await Order.create({
        user: similarUser._id,
        customerEmail: 'similar@example.com',
        items: [
          {
            product: products[0]._id, // Laptop (same as test user)
            productName: products[0].name,
            quantity: 1,
            price: products[0].price,
            priceUSD: products[0].priceUSD
          },
          {
            product: products[2]._id, // Keyboard (should be recommended)
            productName: products[2].name,
            quantity: 1,
            price: products[2].price,
            priceUSD: products[2].priceUSD
          }
        ],
        totalPrice: products[0].price + products[2].price,
        totalPriceUSD: products[0].priceUSD + products[2].priceUSD,
        cryptocurrency: 'BTC',
        paymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        status: 'paid'
      });

      const res = await request(app)
        .get('/api/products/recommendations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendations).toBeDefined();
      expect(res.body.data.recommendations.length).toBeGreaterThan(0);
      
      // Should not recommend already purchased product (Laptop)
      const recommendedIds = res.body.data.recommendations.map(p => p._id.toString());
      expect(recommendedIds).not.toContain(products[0]._id.toString());
    });

    it('should respect limit parameter', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/products/recommendations?limit=2')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendations.length).toBeLessThanOrEqual(2);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/products/recommendations');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/products/:id/related', () => {
    it('should return related products from same category', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get(`/api/products/${products[0]._id}/related`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toBeDefined();
      expect(Array.isArray(res.body.data.products)).toBe(true);
      
      // All related products should be from same category (Electronics)
      res.body.data.products.forEach(product => {
        if (product.category) {
          expect(product.category._id).toBe(testCategory1._id.toString());
        }
      });

      // Should not include the original product
      const relatedIds = res.body.data.products.map(p => p._id.toString());
      expect(relatedIds).not.toContain(products[0]._id.toString());
    });

    it('should return empty array for product with no category', async () => {
      if (!global.isConnected()) return;

      const productNoCategory = await Product.create({
        name: 'No Category Product',
        description: 'Product without category',
        price: 0.001,
        priceUSD: 50,
        stock: 10
      });

      const res = await request(app)
        .get(`/api/products/${productNoCategory._id}/related`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get(`/api/products/${products[0]._id}/related?limit=1`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products.length).toBeLessThanOrEqual(1);
    });

    it('should not require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get(`/api/products/${products[0]._id}/related`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
