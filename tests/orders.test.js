const request = require('supertest');
const app = require('../src/app');
const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const User = require('../src/models/User');
const { generateToken } = require('../src/utils/jwt');

// dgd-core is an external service; orders never talk to it except when the
// buyer confirms delivery (which proposes the payout release). Mock it.
jest.mock('../src/services/dgdCoreClient', () => {
  const mockClient = {
    proposeRelease: jest.fn(async (orderId, by) => ({ orderId, state: 'funded', proposedBy: by })),
  };
  return { DgdCoreClient: jest.fn(() => mockClient), mockClient };
});
const dgd = require('../src/services/dgdCoreClient').mockClient;

describe('Orders API', () => {
  let adminToken;
  let userToken;
  let adminUser;
  let regularUser;
  let testProduct;

  // Re-seed before EVERY test: the global afterEach (tests/setup.js) wipes all
  // collections after each test, so beforeAll fixtures would vanish after test 1.
  beforeEach(async () => {
    // Only run if database is connected
    if (!global.isConnected()) {
      return;
    }

    // Create admin user
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
    });
    adminToken = generateToken(adminUser._id);

    // Create regular user
    regularUser = await User.create({
      name: 'Regular User',
      email: 'user@test.com',
      password: 'password123',
      role: 'user',
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
      isActive: true,
    });
  });

  describe('POST /api/orders', () => {
    it('should create an order with valid data (authenticated user)', async () => {
      if (!global.isConnected()) return;

      const orderData = {
        productId: testProduct._id.toString(),
        quantity: 2,
        customerEmail: 'customer@test.com',
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'USA',
        },
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.order.totalPrice).toBe(0.01);
      expect(res.body.data.order.totalPriceUSD).toBe(500);
      expect(res.body.data.order.settlementAsset).toBe('DGD');
      expect(res.body.data.order.dgdExpectedSats).toBe('1000000'); // 0.01 DGD in sats
      expect(res.body.data.order.dgdEscrowState).toBeNull();
      expect(res.body.data.order.status).toBe('pending');
      expect(res.body.data.next.route).toBe(`/api/dgd-escrow/${res.body.data.order._id}/open`);
      // No funds move on order creation; the buyer opens and funds the escrow next.
      expect(dgd.proposeRelease).not.toHaveBeenCalled();
    });

    it('should require authentication for order creation', async () => {
      if (!global.isConnected()) return;

      const orderCountBefore = await Order.countDocuments();

      const orderData = {
        productId: testProduct._id.toString(),
        quantity: 1,
        customerEmail: 'guest@test.com',
      };

      const res = await request(app).post('/api/orders').send(orderData);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      // `protect` rejects before the controller runs, so the message is the
      // auth middleware's, not the controller's.
      expect(res.body.message).toMatch(
        /Not authorized to access this route|Authentication required/i
      );

      const orderCountAfter = await Order.countDocuments();
      expect(orderCountAfter).toBe(orderCountBefore);
    });

    it('should return error for insufficient stock', async () => {
      if (!global.isConnected()) return;

      const orderData = {
        productId: testProduct._id.toString(),
        quantity: 100,
        customerEmail: 'customer@test.com',
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient stock');
    });

    it('should return error for invalid product', async () => {
      if (!global.isConnected()) return;

      const orderData = {
        productId: '507f1f77bcf86cd799439011',
        quantity: 1,
        customerEmail: 'customer@test.com',
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Product not found');
    });

    it('should reject a request that tries to pick a settlement asset (DGD only)', async () => {
      if (!global.isConnected()) return;

      const orderData = {
        productId: testProduct._id.toString(),
        quantity: 1,
        customerEmail: 'customer@test.com',
        cryptocurrency: 'BTC',
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders/:id', () => {
    let testOrder;

    beforeEach(async () => {
      if (!global.isConnected()) return;

      testOrder = await Order.create({
        user: regularUser._id,
        customerEmail: 'customer@test.com',
        items: [
          {
            product: testProduct._id,
            productName: testProduct.name,
            quantity: 1,
            price: testProduct.price,
            priceUSD: testProduct.priceUSD,
          },
        ],
        totalPrice: testProduct.price,
        totalPriceUSD: testProduct.priceUSD,
        status: 'pending',
      });
    });

    it('should get order by ID (own order)', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.order._id).toBe(testOrder._id.toString());
    });

    it('should get order by ID (admin)', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
    });

    it('should not get other user order', async () => {
      if (!global.isConnected()) return;

      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@test.com',
        password: 'password123',
      });
      const otherToken = generateToken(otherUser._id);

      const res = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return error for non-existent order', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/orders/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders/my-orders', () => {
    beforeEach(async () => {
      if (!global.isConnected()) return;

      // Create multiple orders for user
      await Order.create([
        {
          user: regularUser._id,
          customerEmail: 'customer@test.com',
          items: [
            {
              product: testProduct._id,
              productName: testProduct.name,
              quantity: 1,
              price: testProduct.price,
              priceUSD: testProduct.priceUSD,
            },
          ],
          totalPrice: testProduct.price,
          totalPriceUSD: testProduct.priceUSD,
          status: 'pending',
        },
        {
          user: regularUser._id,
          customerEmail: 'customer@test.com',
          items: [
            {
              product: testProduct._id,
              productName: testProduct.name,
              quantity: 2,
              price: testProduct.price,
              priceUSD: testProduct.priceUSD,
            },
          ],
          totalPrice: testProduct.price * 2,
          totalPriceUSD: testProduct.priceUSD * 2,
          status: 'paid',
        },
      ]);
    });

    it('should get user orders', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toBeDefined();
      expect(res.body.data.orders.length).toBeGreaterThanOrEqual(2);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app).get('/api/orders/my-orders');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders (Admin)', () => {
    beforeEach(async () => {
      if (!global.isConnected()) return;

      // Create test orders
      await Order.create([
        {
          user: regularUser._id,
          customerEmail: 'customer1@test.com',
          items: [
            {
              product: testProduct._id,
              productName: testProduct.name,
              quantity: 1,
              price: testProduct.price,
              priceUSD: testProduct.priceUSD,
            },
          ],
          totalPrice: testProduct.price,
          totalPriceUSD: testProduct.priceUSD,
          status: 'pending',
        },
        {
          user: regularUser._id,
          customerEmail: 'customer2@test.com',
          items: [
            {
              product: testProduct._id,
              productName: testProduct.name,
              quantity: 1,
              price: testProduct.price,
              priceUSD: testProduct.priceUSD,
            },
          ],
          totalPrice: testProduct.price,
          totalPriceUSD: testProduct.priceUSD,
          status: 'paid',
        },
      ]);
    });

    it('should get all orders (admin)', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should filter orders by status', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .get('/api/orders?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toBeDefined();
      expect(res.body.data.orders.every(o => o.status === 'pending')).toBe(true);
    });

    it('should not allow regular user to access', async () => {
      if (!global.isConnected()) return;

      const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app).get('/api/orders');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/orders/:id/status (Admin)', () => {
    let testOrder;

    beforeEach(async () => {
      if (!global.isConnected()) return;

      testOrder = await Order.create({
        user: regularUser._id,
        customerEmail: 'customer@test.com',
        items: [
          {
            product: testProduct._id,
            productName: testProduct.name,
            quantity: 1,
            price: testProduct.price,
            priceUSD: testProduct.priceUSD,
          },
        ],
        totalPrice: testProduct.price,
        totalPriceUSD: testProduct.priceUSD,
        status: 'pending',
      });
    });

    it('should update order status (admin)', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .put(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('shipped');
    });

    it('should not allow regular user to update status', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .put(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'shipped' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .put(`/api/orders/${testOrder._id}/status`)
        .send({ status: 'shipped' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return error for non-existent order', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .put('/api/orders/507f1f77bcf86cd799439011/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/orders/:id/confirm-delivery', () => {
    let fundedOrder;

    beforeEach(async () => {
      if (!global.isConnected()) return;
      dgd.proposeRelease.mockClear();

      fundedOrder = await Order.create({
        user: regularUser._id,
        customerEmail: 'customer@test.com',
        items: [
          {
            product: testProduct._id,
            productName: testProduct.name,
            quantity: 1,
            price: testProduct.price,
            priceUSD: testProduct.priceUSD,
          },
        ],
        totalPrice: testProduct.price,
        totalPriceUSD: testProduct.priceUSD,
        dgdExpectedSats: '500000',
        dgdEscrowId: undefined,
        dgdEscrowAddress: 'dgrt1qescrowaddressxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        dgdEscrowState: 'funded',
        status: 'shipped',
      });
    });

    it('should propose escrow release to dgd-core when the buyer confirms delivery', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post(`/api/orders/${fundedOrder._id}/confirm-delivery`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(dgd.proposeRelease).toHaveBeenCalledTimes(1);
      expect(dgd.proposeRelease).toHaveBeenCalledWith(
        fundedOrder._id.toString(),
        'buyer',
        undefined,
        `confirm-delivery:${fundedOrder._id}`
      );
      expect(res.body.data.next.action).toBe('sign-payout');

      const updated = await Order.findById(fundedOrder._id);
      expect(updated.deliveryConfirmedAt).toBeDefined();
      // Funds have not moved: release needs threshold signatures from the parties' wallets.
      expect(updated.dgdEscrowState).toBe('funded');
      expect(updated.status).toBe('shipped');
    });

    it('should refuse delivery confirmation when the escrow is not funded', async () => {
      if (!global.isConnected()) return;

      fundedOrder.dgdEscrowState = 'created';
      await fundedOrder.save();

      const res = await request(app)
        .post(`/api/orders/${fundedOrder._id}/confirm-delivery`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(409);
      expect(dgd.proposeRelease).not.toHaveBeenCalled();
    });

    it('should not let another user confirm delivery', async () => {
      if (!global.isConnected()) return;

      const res = await request(app)
        .post(`/api/orders/${fundedOrder._id}/confirm-delivery`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(dgd.proposeRelease).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/orders/:id/status guards', () => {
    it('should not allow cancelling an order with a funded escrow', async () => {
      if (!global.isConnected()) return;

      const order = await Order.create({
        user: regularUser._id,
        customerEmail: 'customer@test.com',
        items: [
          {
            product: testProduct._id,
            productName: testProduct.name,
            quantity: 1,
            price: testProduct.price,
            priceUSD: testProduct.priceUSD,
          },
        ],
        totalPrice: testProduct.price,
        totalPriceUSD: testProduct.priceUSD,
        dgdEscrowState: 'funded',
        status: 'paid',
      });

      const res = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(409);
    });

    it('should not allow an admin to mark an order paid by hand', async () => {
      if (!global.isConnected()) return;

      const order = await Order.create({
        user: regularUser._id,
        customerEmail: 'customer@test.com',
        items: [
          {
            product: testProduct._id,
            productName: testProduct.name,
            quantity: 1,
            price: testProduct.price,
            priceUSD: testProduct.priceUSD,
          },
        ],
        totalPrice: testProduct.price,
        totalPriceUSD: testProduct.priceUSD,
        status: 'pending',
      });

      const res = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paid' });

      expect(res.status).toBe(400);
    });
  });
});
