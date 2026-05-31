const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const jwt = require('jsonwebtoken');

let mongoServer;
let adminToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create admin user
  const adminUser = await User.create({
    name: 'Admin User',
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin'
  });

  adminToken = jwt.sign(
    { id: adminUser._id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Category.deleteMany({});
});

describe('Product Reorder', () => {
  it('should reorder products successfully', async () => {
    const category = await Category.create({
      name: 'Test Category',
      slug: 'test-category'
    });

    const product1 = await Product.create({
      name: 'Product 1',
      description: 'Test product 1',
      price: 0.01,
      priceUSD: 100,
      currency: 'BTC',
      stock: 10,
      category: category._id,
      sortOrder: 0
    });

    const product2 = await Product.create({
      name: 'Product 2',
      description: 'Test product 2',
      price: 0.02,
      priceUSD: 200,
      currency: 'BTC',
      stock: 20,
      category: category._id,
      sortOrder: 1
    });

    const response = await request(app)
      .put('/api/admin/products/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productOrders: [
          { productId: product1._id.toString(), sortOrder: 1 },
          { productId: product2._id.toString(), sortOrder: 0 }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const updatedProduct1 = await Product.findById(product1._id);
    const updatedProduct2 = await Product.findById(product2._id);

    expect(updatedProduct1.sortOrder).toBe(1);
    expect(updatedProduct2.sortOrder).toBe(0);
  });

  it('should return error for invalid product orders', async () => {
    const response = await request(app)
      .put('/api/admin/products/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productOrders: 'invalid'
      });

    expect(response.status).toBe(400);
  });
});

describe('Export Endpoints', () => {
  it('should export products to CSV', async () => {
    const category = await Category.create({
      name: 'Test Category',
      slug: 'test-category'
    });

    await Product.create({
      name: 'Test Product',
      description: 'Test description',
      price: 0.01,
      priceUSD: 100,
      currency: 'BTC',
      stock: 10,
      category: category._id
    });

    const response = await request(app)
      .get('/api/admin/products/export/csv')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
  });

  it('should export products to PDF', async () => {
    const category = await Category.create({
      name: 'Test Category',
      slug: 'test-category'
    });

    await Product.create({
      name: 'Test Product',
      description: 'Test description',
      price: 0.01,
      priceUSD: 100,
      currency: 'BTC',
      stock: 10,
      category: category._id
    });

    const response = await request(app)
      .get('/api/admin/products/export/pdf')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
  });

  it('should require admin authentication for exports', async () => {
    const response = await request(app)
      .get('/api/admin/products/export/csv');

    expect(response.status).toBe(401);
  });
});
