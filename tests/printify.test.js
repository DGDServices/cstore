const request = require('supertest');
const app = require('../src/app');
const PodProduct = require('../src/models/PodProduct');
const PodOrder = require('../src/models/PodOrder');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const User = require('../src/models/User');

describe('Printify POD Integration', () => {
  let adminToken;
  let userToken;
  let userId;
  let testProduct;
  let testPodProduct;
  let testOrder;

  beforeAll(async () => {
    // Create admin user
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@printify.test',
        password: 'admin123'
      });

    await User.findByIdAndUpdate(adminRes.body.data.user.id, { role: 'admin' });
    
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@printify.test',
        password: 'admin123'
      });
    
    adminToken = adminLoginRes.body.data.token;

    // Create regular user
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'user@printify.test',
        password: 'user123'
      });
    
    userId = userRes.body.data.user.id;
    userToken = userRes.body.data.token;

    // Create test standard product
    testProduct = await Product.create({
      name: 'Test POD T-Shirt',
      description: 'A test POD product',
      price: 19.99,
      priceUSD: 19.99,
      currency: 'USD',
      stock: 999,
      isActive: true
    });

    // Create test POD product
    testPodProduct = await PodProduct.create({
      product: testProduct._id,
      printifyProductId: 'test-printify-123',
      printifyBlueprintId: '5',
      printifyPrintProviderId: 99,
      title: 'Test POD T-Shirt',
      description: 'A test POD product',
      variants: [{
        printifyVariantId: '12345',
        sku: 'TEST-M-BLK',
        title: 'Medium / Black',
        price: 19.99,
        cost: 9.99,
        isEnabled: true,
        options: {
          size: 'M',
          color: 'Black'
        },
        isAvailable: true
      }],
      syncStatus: 'synced',
      isPublished: true,
      isActive: true
    });

    // Create test order
    testOrder = await Order.create({
      user: userId,
      customerEmail: 'user@printify.test',
      items: [{
        product: testProduct._id,
        productName: testProduct.name,
        quantity: 1,
        price: 19.99,
        priceUSD: 19.99
      }],
      totalPrice: 19.99,
      totalPriceUSD: 19.99,
      displayCurrency: 'USD',
      selectedCurrency: 'USD',
      status: 'pending',
      paymentStatus: 'pending'
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: /printify\.test/ });
    await Product.deleteMany({ name: /Test POD/ });
    await PodProduct.deleteMany({});
    await PodOrder.deleteMany({});
    await Order.deleteMany({ customerEmail: 'user@printify.test' });
  });

  describe('GET /api/printify/products', () => {
    it('should get all POD products', async () => {
      const res = await request(app)
        .get('/api/printify/products')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('products');
      expect(res.body.data).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data.products)).toBe(true);
    });

    it('should filter POD products by sync status', async () => {
      const res = await request(app)
        .get('/api/printify/products?syncStatus=synced')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.products.every(p => p.syncStatus === 'synced')).toBe(true);
    });

    it('should filter POD products by published status', async () => {
      const res = await request(app)
        .get('/api/printify/products?isPublished=true')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.products.every(p => p.isPublished === true)).toBe(true);
    });
  });

  describe('GET /api/printify/products/:id', () => {
    it('should get a single POD product', async () => {
      const res = await request(app)
        .get(`/api/printify/products/${testPodProduct._id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.product).toHaveProperty('printifyProductId');
      expect(res.body.data.product.title).toBe('Test POD T-Shirt');
    });

    it('should return 404 for non-existent POD product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/printify/products/${fakeId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/printify/orders', () => {
    it('should create a POD order when authenticated', async () => {
      const orderData = {
        orderId: testOrder._id,
        items: [{
          podProductId: testPodProduct._id,
          printifyProductId: testPodProduct.printifyProductId,
          variantId: testPodProduct.variants[0].printifyVariantId,
          quantity: 1,
          price: 19.99,
          cost: 9.99
        }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          country: 'US',
          address1: '123 Main St',
          city: 'New York',
          zip: '10001'
        }
      };

      const res = await request(app)
        .post('/api/printify/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.podOrder).toHaveProperty('_id');
      expect(res.body.data.podOrder.status).toBe('draft');
    });

    it('should require authentication to create POD order', async () => {
      const orderData = {
        orderId: testOrder._id,
        items: [],
        shippingAddress: {}
      };

      await request(app)
        .post('/api/printify/orders')
        .send(orderData)
        .expect(401);
    });

    it('should validate required order fields', async () => {
      const res = await request(app)
        .post('/api/printify/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderId: testOrder._id,
          items: []
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Admin POD Management', () => {
    describe('GET /api/admin/pod/stats', () => {
      it('should get POD statistics for admin', async () => {
        const res = await request(app)
          .get('/api/admin/pod/stats')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('products');
        expect(res.body.data).toHaveProperty('orders');
        expect(res.body.data).toHaveProperty('revenue');
      });

      it('should require admin role for POD stats', async () => {
        await request(app)
          .get('/api/admin/pod/stats')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('GET /api/admin/pod/products', () => {
      it('should get all POD products for admin', async () => {
        const res = await request(app)
          .get('/api/admin/pod/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('products');
        expect(Array.isArray(res.body.data.products)).toBe(true);
      });

      it('should support search in admin POD products', async () => {
        const res = await request(app)
          .get('/api/admin/pod/products?search=shirt')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
      });
    });

    describe('PUT /api/admin/pod/products/:id', () => {
      it('should update POD product', async () => {
        const res = await request(app)
          .put(`/api/admin/pod/products/${testPodProduct._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isActive: false })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.product.isActive).toBe(false);
      });

      it('should require admin role to update POD product', async () => {
        await request(app)
          .put(`/api/admin/pod/products/${testPodProduct._id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ isActive: false })
          .expect(403);
      });
    });

    describe('DELETE /api/admin/pod/products/:id', () => {
      it('should soft delete POD product', async () => {
        const res = await request(app)
          .delete(`/api/admin/pod/products/${testPodProduct._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);

        const deletedProduct = await PodProduct.findById(testPodProduct._id);
        expect(deletedProduct.isActive).toBe(false);
      });
    });

    describe('GET /api/admin/pod/orders', () => {
      it('should get all POD orders for admin', async () => {
        const res = await request(app)
          .get('/api/admin/pod/orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('orders');
        expect(Array.isArray(res.body.data.orders)).toBe(true);
      });

      it('should filter POD orders by status', async () => {
        const res = await request(app)
          .get('/api/admin/pod/orders?status=draft')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
      });
    });
  });

  describe('Webhook Verification', () => {
    it('should reject webhooks without signature', async () => {
      const res = await request(app)
        .post('/api/printify/webhooks')
        .send({ type: 'order:created', resource: {} })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject webhooks with invalid signature', async () => {
      const res = await request(app)
        .post('/api/printify/webhooks')
        .set('x-printify-signature', 'invalid-signature')
        .send({ type: 'order:created', resource: {} })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POD Product Model', () => {
    it('should create POD product with required fields', async () => {
      const podProductData = {
        product: testProduct._id,
        printifyProductId: 'test-123',
        printifyBlueprintId: '5',
        printifyPrintProviderId: 99,
        title: 'Test Product',
        variants: [{
          printifyVariantId: '123',
          price: 20,
          cost: 10,
          isEnabled: true,
          isAvailable: true
        }]
      };

      const podProduct = await PodProduct.create(podProductData);
      expect(podProduct._id).toBeDefined();
      expect(podProduct.syncStatus).toBe('pending');
      expect(podProduct.isPublished).toBe(false);
    });

    it('should mark product as synced', async () => {
      const podProduct = await PodProduct.create({
        product: testProduct._id,
        printifyProductId: 'test-456',
        printifyBlueprintId: '5',
        printifyPrintProviderId: 99,
        title: 'Test Product 2',
        variants: []
      });

      await podProduct.markSynced();
      expect(podProduct.syncStatus).toBe('synced');
      expect(podProduct.lastSyncedAt).toBeDefined();
    });

    it('should mark product sync as failed', async () => {
      const podProduct = await PodProduct.create({
        product: testProduct._id,
        printifyProductId: 'test-789',
        printifyBlueprintId: '5',
        printifyPrintProviderId: 99,
        title: 'Test Product 3',
        variants: []
      });

      await podProduct.markSyncFailed('Test error');
      expect(podProduct.syncStatus).toBe('failed');
      expect(podProduct.syncError).toBe('Test error');
    });
  });

  describe('POD Order Model', () => {
    it('should create POD order with required fields', async () => {
      const podOrderData = {
        order: testOrder._id,
        items: [{
          podProduct: testPodProduct._id,
          printifyProductId: 'test-123',
          variantId: '123',
          quantity: 1,
          price: 20,
          cost: 10
        }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          country: 'US',
          address1: '123 Main St',
          city: 'New York',
          zip: '10001'
        },
        totalCost: 10,
        totalPrice: 20
      };

      const podOrder = await PodOrder.create(podOrderData);
      expect(podOrder._id).toBeDefined();
      expect(podOrder.status).toBe('draft');
    });

    it('should update order status and record history', async () => {
      const podOrder = await PodOrder.create({
        order: testOrder._id,
        items: [],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          country: 'US',
          address1: '123 Main St',
          city: 'New York',
          zip: '10001'
        },
        totalCost: 10,
        totalPrice: 20
      });

      await podOrder.updateStatus('pending', 'Submitted to Printify');
      expect(podOrder.status).toBe('pending');
      expect(podOrder.statusHistory.length).toBeGreaterThan(0);
      expect(podOrder.submittedAt).toBeDefined();
    });

    it('should record webhook events', async () => {
      const podOrder = await PodOrder.create({
        order: testOrder._id,
        items: [],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          country: 'US',
          address1: '123 Main St',
          city: 'New York',
          zip: '10001'
        },
        totalCost: 10,
        totalPrice: 20
      });

      await podOrder.recordWebhookEvent('order:created', { id: '123' });
      expect(podOrder.webhookEvents.length).toBe(1);
      expect(podOrder.webhookEvents[0].event).toBe('order:created');
    });
  });
});
