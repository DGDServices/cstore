const request = require('supertest');
const app = require('../src/app');
const Payment = require('../src/models/Payment');
const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const Escrow = require('../src/models/Escrow');
const User = require('../src/models/User');
const { generateToken } = require('../src/utils/jwt');

describe('Payments API', () => {
  let adminToken;
  let userToken;
  let adminUser;
  let regularUser;
  let testProduct;
  let testOrder;

  beforeAll(async () => {
    if (!global.isConnected()) return;

    // Create admin user
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });
    adminToken = generateToken(adminUser._id);

    // Create regular user
    regularUser = await User.create({
      name: 'Regular User',
      email: 'user@test.com',
      password: 'password123',
      role: 'user'
    });
    userToken = generateToken(regularUser._id);

    // Create test product
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test product description',
      price: 0.005,
      priceUSD: 250,
      seller: adminUser._id,
      stock: 10,
      currency: 'BTC',
      isActive: true
    });
  });

  beforeEach(async () => {
    if (!global.isConnected()) return;

    // Create test order for each test
    testOrder = await Order.create({
      user: regularUser._id,
      customerEmail: 'customer@test.com',
      items: [{
        product: testProduct._id,
        productName: testProduct.name,
        quantity: 1,
        price: testProduct.price,
        priceUSD: testProduct.priceUSD
      }],
      totalPrice: testProduct.price,
      totalPriceUSD: testProduct.priceUSD,
      cryptocurrency: 'BTC',
      paymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      status: 'pending'
    });

    const escrow = await Escrow.create({
      buyer: regularUser._id,
      seller: adminUser._id,
      order: testOrder._id,
      title: 'Test payment escrow',
      amount: testOrder.totalPrice,
      cryptocurrency: testOrder.cryptocurrency,
      amountUSD: testOrder.totalPriceUSD,
      depositAddress: testOrder.paymentAddress,
      releaseType: 'manual',
      releaseConditions: [{ type: 'delivery_confirmation' }]
    });

    testOrder.escrow = escrow._id;
    await testOrder.save();
  });

  describe('POST /api/payments/confirm', () => {
    it('should confirm payment with valid transaction hash', async () => {
      if (!global.isConnected()) return;

      const paymentData = {
        orderId: testOrder._id.toString(),
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      };

      const res = await request(app)
        .post('/api/payments/confirm')
        .send(paymentData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment).toBeDefined();
      expect(res.body.data.payment.transactionHash).toBe(paymentData.transactionHash);
      expect(res.body.data.order.status).toBe('paid');
    });

    it('should reject duplicate transaction hash', async () => {
      if (!global.isConnected()) return;

      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      // First payment
      await Payment.create({
        order: testOrder._id,
        transactionHash: txHash,
        cryptocurrency: 'BTC',
        amount: testOrder.totalPrice,
        amountUSD: testOrder.totalPriceUSD,
        toAddress: testOrder.paymentAddress,
        status: 'confirmed'
      });

      // Create another order
      const newOrder = await Order.create({
        user: regularUser._id,
        customerEmail: 'customer@test.com',
        items: [{
          product: testProduct._id,
          productName: testProduct.name,
          quantity: 1,
          price: testProduct.price,
          priceUSD: testProduct.priceUSD
        }],
        totalPrice: testProduct.price,
        totalPriceUSD: testProduct.priceUSD,
        cryptocurrency: 'BTC',
        paymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        status: 'pending'
      });

      const newEscrow = await Escrow.create({
        buyer: regularUser._id,
        seller: adminUser._id,
        order: newOrder._id,
        title: 'Duplicate hash escrow',
        amount: newOrder.totalPrice,
        cryptocurrency: newOrder.cryptocurrency,
        amountUSD: newOrder.totalPriceUSD,
        depositAddress: newOrder.paymentAddress,
        releaseType: 'manual',
        releaseConditions: [{ type: 'delivery_confirmation' }]
      });
      newOrder.escrow = newEscrow._id;
      await newOrder.save();

      // Try to use same transaction hash
      const res = await request(app)
        .post('/api/payments/confirm')
        .send({
          orderId: newOrder._id.toString(),
          transactionHash: txHash
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Transaction hash already used');
    });

    it('should reject payment for already paid order', async () => {
      if (!global.isConnected()) return;

      // Mark order as paid
      testOrder.status = 'paid';
      await testOrder.save();

      const res = await request(app)
        .post('/api/payments/confirm')
        .send({
          orderId: testOrder._id.toString(),
          transactionHash: '0xnew1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Order already paid');
    });

    it('should return error for non-existent order', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/payments/confirm')
        .send({
          orderId: '507f1f77bcf86cd799439011',
          transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Order not found');
    });

    it('should validate required fields', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/payments/confirm')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should update product stock after payment', async () => {
      if (!global.isConnected()) return;

      const initialStock = testProduct.stock;

      await request(app)
        .post('/api/payments/confirm')
        .send({
          orderId: testOrder._id.toString(),
          transactionHash: '0xstock1234567890abcdef1234567890abcdef1234567890abcdef12345678'
        });

      // Refresh product from database
      const updatedProduct = await Product.findById(testProduct._id);
      
      expect(updatedProduct.stock).toBe(initialStock - testOrder.items[0].quantity);
    });
  });

  describe('GET /api/payments/order/:orderId', () => {
    let testPayment;

    beforeEach(async () => {
      if (!global.isConnected()) return;

      testPayment = await Payment.create({
        order: testOrder._id,
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        cryptocurrency: 'BTC',
        amount: testOrder.totalPrice,
        amountUSD: testOrder.totalPriceUSD,
        toAddress: testOrder.paymentAddress,
        status: 'confirmed'
      });
    });

    it('should get payment by order ID', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get(`/api/payments/order/${testOrder._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment).toBeDefined();
      expect(res.body.data.payment._id).toBe(testPayment._id.toString());
    });

    it('should return error for non-existent payment', async () => {
      if (!global.isConnected()) return;

      const newOrder = await Order.create({
        user: regularUser._id,
        customerEmail: 'customer@test.com',
        items: [{
          product: testProduct._id,
          productName: testProduct.name,
          quantity: 1,
          price: testProduct.price,
          priceUSD: testProduct.priceUSD
        }],
        totalPrice: testProduct.price,
        totalPriceUSD: testProduct.priceUSD,
        cryptocurrency: 'BTC',
        paymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        status: 'pending'
      });

      const res = await request(app)
        .get(`/api/payments/order/${newOrder._id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/payments (Admin)', () => {
    beforeEach(async () => {
      if (!global.isConnected()) return;

      // Create multiple payments
      const order1 = await Order.create({
        user: regularUser._id,
        customerEmail: 'customer1@test.com',
        items: [{
          product: testProduct._id,
          productName: testProduct.name,
          quantity: 1,
          price: testProduct.price,
          priceUSD: testProduct.priceUSD
        }],
        totalPrice: testProduct.price,
        totalPriceUSD: testProduct.priceUSD,
        cryptocurrency: 'BTC',
        paymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        status: 'paid'
      });

      const order2 = await Order.create({
        user: regularUser._id,
        customerEmail: 'customer2@test.com',
        items: [{
          product: testProduct._id,
          productName: testProduct.name,
          quantity: 1,
          price: testProduct.price,
          priceUSD: testProduct.priceUSD
        }],
        totalPrice: testProduct.price,
        totalPriceUSD: testProduct.priceUSD,
        cryptocurrency: 'ETH',
        paymentAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        status: 'paid'
      });

      await Payment.create([
        {
          order: order1._id,
          transactionHash: '0xpayment11234567890abcdef1234567890abcdef1234567890abcdef12345',
          cryptocurrency: 'BTC',
          amount: order1.totalPrice,
          amountUSD: order1.totalPriceUSD,
          toAddress: order1.paymentAddress,
          status: 'confirmed'
        },
        {
          order: order2._id,
          transactionHash: '0xpayment21234567890abcdef1234567890abcdef1234567890abcdef12345',
          cryptocurrency: 'ETH',
          amount: order2.totalPrice,
          amountUSD: order2.totalPriceUSD,
          toAddress: order2.paymentAddress,
          status: 'pending'
        }
      ]);
    });

    it('should get all payments (admin)', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payments).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should filter payments by status', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/payments?status=confirmed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payments).toBeDefined();
      expect(res.body.data.payments.every(p => p.status === 'confirmed')).toBe(true);
    });

    it('should not allow regular user to access', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/payments');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/:id/verify (Admin)', () => {
    let testPayment;

    beforeEach(async () => {
      if (!global.isConnected()) return;

      testPayment = await Payment.create({
        order: testOrder._id,
        transactionHash: '0xverify1234567890abcdef1234567890abcdef1234567890abcdef12345678',
        cryptocurrency: 'BTC',
        amount: testOrder.totalPrice,
        amountUSD: testOrder.totalPriceUSD,
        toAddress: testOrder.paymentAddress,
        status: 'pending'
      });
    });

    it('should allow admin to verify payment', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post(`/api/payments/${testPayment._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment).toBeDefined();
    });

    it('should not allow regular user to verify payment', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post(`/api/payments/${testPayment._id}/verify`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post(`/api/payments/${testPayment._id}/verify`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return error for non-existent payment', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/payments/507f1f77bcf86cd799439011/verify')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
