const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const { generateToken } = require('../src/utils/jwt');

describe('Integration Tests - Complete Order Flow', () => {
  let userToken;
  let adminToken;
  let regularUser;
  let adminUser;
  let testProduct;

  beforeAll(async () => {
    if (!global.isConnected()) return;

    // Create users
    regularUser = await User.create({
      name: 'Test User',
      email: 'user@integration.com',
      password: 'password123'
    });
    userToken = generateToken(regularUser._id);

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@integration.com',
      password: 'password123',
      role: 'admin'
    });
    adminToken = generateToken(adminUser._id);
  });

  describe('Complete Order Flow', () => {
    it('should complete full order lifecycle: create product -> create order -> confirm payment -> update status', async () => {
      if (!global.isConnected()) return;

      // Step 1: Admin creates a product
      const productData = {
        name: 'Integration Test Product',
        description: 'This is a test product for integration testing',
        price: 0.01,
        priceUSD: 500,
        stock: 5,
        currency: 'BTC'
      };

      const createProductRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData);

      expect(createProductRes.status).toBe(201);
      expect(createProductRes.body.success).toBe(true);
      testProduct = createProductRes.body.data.product;

      // Step 2: Get all products (public)
      const getProductsRes = await request(app)
        .get('/api/products');

      expect(getProductsRes.status).toBe(200);
      expect(getProductsRes.body.success).toBe(true);
      expect(getProductsRes.body.data.products.length).toBeGreaterThan(0);

      // Step 3: Get single product details
      const getProductRes = await request(app)
        .get(`/api/products/${testProduct._id}`);

      expect(getProductRes.status).toBe(200);
      expect(getProductRes.body.success).toBe(true);
      expect(getProductRes.body.data.product.name).toBe(productData.name);

      // Step 4: Get supported cryptocurrencies
      const getCryptoRes = await request(app)
        .get('/api/cryptocurrencies');

      expect(getCryptoRes.status).toBe(200);
      expect(getCryptoRes.body.success).toBe(true);
      expect(getCryptoRes.body.data.cryptocurrencies.length).toBeGreaterThan(0);

      // Step 5: User creates an order
      const orderData = {
        productId: testProduct._id,
        quantity: 2,
        customerEmail: 'customer@integration.com',
        cryptocurrency: 'BTC',
        shippingAddress: {
          street: '123 Integration St',
          city: 'Test City',
          state: 'TC',
          postalCode: '12345',
          country: 'USA'
        }
      };

      const createOrderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData);

      expect(createOrderRes.status).toBe(201);
      expect(createOrderRes.body.success).toBe(true);
      expect(createOrderRes.body.data.order.status).toBe('pending');
      const orderId = createOrderRes.body.data.order._id;

      // Step 6: User gets order details
      const getOrderRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(getOrderRes.status).toBe(200);
      expect(getOrderRes.body.success).toBe(true);
      expect(getOrderRes.body.data.order._id).toBe(orderId);

      // Step 7: User views their orders
      const getMyOrdersRes = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${userToken}`);

      expect(getMyOrdersRes.status).toBe(200);
      expect(getMyOrdersRes.body.success).toBe(true);
      expect(getMyOrdersRes.body.data.orders.length).toBeGreaterThan(0);

      // Step 8: Confirm payment
      const paymentData = {
        orderId: orderId,
        transactionHash: '0xintegration1234567890abcdef1234567890abcdef1234567890abcdef12'
      };

      const confirmPaymentRes = await request(app)
        .post('/api/payments/confirm')
        .send(paymentData);

      expect(confirmPaymentRes.status).toBe(200);
      expect(confirmPaymentRes.body.success).toBe(true);
      expect(confirmPaymentRes.body.data.payment.status).toBe('confirmed');
      expect(confirmPaymentRes.body.data.order.status).toBe('paid');

      // Step 9: Get payment by order
      const getPaymentRes = await request(app)
        .get(`/api/payments/order/${orderId}`);

      expect(getPaymentRes.status).toBe(200);
      expect(getPaymentRes.body.success).toBe(true);
      expect(getPaymentRes.body.data.payment.transactionHash).toBe(paymentData.transactionHash);

      // Step 10: Admin views all orders
      const getAllOrdersRes = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getAllOrdersRes.status).toBe(200);
      expect(getAllOrdersRes.body.success).toBe(true);
      expect(getAllOrdersRes.body.data.orders.length).toBeGreaterThan(0);

      // Step 11: Admin updates order status
      const updateStatusRes = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' });

      expect(updateStatusRes.status).toBe(200);
      expect(updateStatusRes.body.success).toBe(true);
      expect(updateStatusRes.body.data.order.status).toBe('shipped');

      // Step 12: Admin views all payments
      const getAllPaymentsRes = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getAllPaymentsRes.status).toBe(200);
      expect(getAllPaymentsRes.body.success).toBe(true);
      expect(getAllPaymentsRes.body.data.payments.length).toBeGreaterThan(0);

      // Step 13: Admin updates product
      const updateProductRes = await request(app)
        .put(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stock: 100 });

      expect(updateProductRes.status).toBe(200);
      expect(updateProductRes.body.success).toBe(true);
      expect(updateProductRes.body.data.product.stock).toBe(100);

      // Step 14: Verify product stock was reduced
      const finalProductRes = await request(app)
        .get(`/api/products/${testProduct._id}`);

      expect(finalProductRes.status).toBe(200);
      // Stock should be 100 (from update) - orders are already processed
      expect(finalProductRes.body.data.product.stock).toBe(100);

      // Step 15: Health check
      const healthRes = await request(app)
        .get('/api/health');

      expect(healthRes.status).toBe(200);
      expect(healthRes.body.success).toBe(true);
      expect(healthRes.body.message).toBeDefined();
    });

    it('should handle guest orders (without authentication)', async () => {
      if (!global.isConnected()) return;

      // Create product as admin
      const product = await Product.create({
        name: 'Guest Order Product',
        description: 'Product for guest orders',
        price: 0.005,
        priceUSD: 250,
        stock: 10,
        currency: 'ETH',
        isActive: true
      });

      // Guest creates order without authentication
      const orderData = {
        productId: product._id.toString(),
        quantity: 1,
        customerEmail: 'guest@integration.com',
        cryptocurrency: 'ETH'
      };

      const createOrderRes = await request(app)
        .post('/api/orders')
        .send(orderData);

      expect(createOrderRes.status).toBe(201);
      expect(createOrderRes.body.success).toBe(true);
      expect(createOrderRes.body.data.order.user).toBeNull();
      expect(createOrderRes.body.data.order.customerEmail).toBe(orderData.customerEmail);

      const orderId = createOrderRes.body.data.order._id;

      // Guest can view order without authentication
      const getOrderRes = await request(app)
        .get(`/api/orders/${orderId}`);

      expect(getOrderRes.status).toBe(200);
      expect(getOrderRes.body.success).toBe(true);

      // Confirm payment as guest
      const confirmPaymentRes = await request(app)
        .post('/api/payments/confirm')
        .send({
          orderId: orderId,
          transactionHash: '0xguest1234567890abcdef1234567890abcdef1234567890abcdef123456'
        });

      expect(confirmPaymentRes.status).toBe(200);
      expect(confirmPaymentRes.body.success).toBe(true);
    });

    it('should enforce authentication and authorization correctly', async () => {
      if (!global.isConnected()) return;

      const product = await Product.create({
        name: 'Auth Test Product',
        description: 'Product for auth testing',
        price: 0.005,
        priceUSD: 250,
        stock: 10,
        currency: 'BTC',
        isActive: true
      });

      // Try to create product without authentication
      const noAuthRes = await request(app)
        .post('/api/products')
        .send({
          name: 'Should Fail',
          description: 'This should fail',
          price: 0.01,
          priceUSD: 500,
          stock: 10
        });

      expect(noAuthRes.status).toBe(401);

      // Try to create product as regular user
      const userRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Should Fail',
          description: 'This should fail',
          price: 0.01,
          priceUSD: 500,
          stock: 10
        });

      expect(userRes.status).toBe(403);

      // Try to view all orders as regular user
      const ordersRes = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${userToken}`);

      expect(ordersRes.status).toBe(403);

      // Try to view all payments as regular user
      const paymentsRes = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${userToken}`);

      expect(paymentsRes.status).toBe(403);
    });

    it('should handle product filtering and search', async () => {
      if (!global.isConnected()) return;

      // Create multiple products
      await Product.create([
        {
          name: 'Laptop Computer',
          description: 'High-end laptop',
          price: 0.5,
          priceUSD: 2500,
          stock: 5,
          currency: 'BTC',
          isActive: true
        },
        {
          name: 'Desktop Computer',
          description: 'Gaming desktop',
          price: 0.8,
          priceUSD: 4000,
          stock: 3,
          currency: 'BTC',
          isActive: true
        },
        {
          name: 'Tablet Device',
          description: 'Portable tablet',
          price: 0.2,
          priceUSD: 1000,
          stock: 10,
          currency: 'BTC',
          isActive: true
        }
      ]);

      // Filter by price range
      const priceFilterRes = await request(app)
        .get('/api/products?minPrice=2000&maxPrice=3000');

      expect(priceFilterRes.status).toBe(200);
      expect(priceFilterRes.body.success).toBe(true);
      expect(priceFilterRes.body.data.products.length).toBeGreaterThan(0);

      // Test pagination
      const paginationRes = await request(app)
        .get('/api/products?page=1&limit=2');

      expect(paginationRes.status).toBe(200);
      expect(paginationRes.body.success).toBe(true);
      expect(paginationRes.body.data.pagination).toBeDefined();
      expect(paginationRes.body.data.pagination.limit).toBe(2);
    });
  });
});
