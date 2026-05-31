const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const MultiSigWallet = require('../src/models/MultiSigWallet');
const TransactionApproval = require('../src/models/TransactionApproval');

let authToken;
let userId;
let signer1Token;
let signer1Id;
let signer2Token;
let signer2Id;
let walletId;
let transactionId;

describe('Multi-Signature Wallet API', () => {
  beforeAll(async () => {
    // Skip if database not connected
    if (mongoose.connection.readyState !== 1) {
      console.log('Skipping multi-sig wallet tests - database not connected');
      return;
    }

    // Create test users
    const owner = await User.create({
      name: 'Wallet Owner',
      email: 'owner@test.com',
      password: 'password123'
    });
    userId = owner._id;

    const signer1 = await User.create({
      name: 'Signer One',
      email: 'signer1@test.com',
      password: 'password123'
    });
    signer1Id = signer1._id;

    const signer2 = await User.create({
      name: 'Signer Two',
      email: 'signer2@test.com',
      password: 'password123'
    });
    signer2Id = signer2._id;

    // Get auth tokens
    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@test.com', password: 'password123' });
    authToken = ownerLogin.body.token;

    const signer1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'signer1@test.com', password: 'password123' });
    signer1Token = signer1Login.body.token;

    const signer2Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'signer2@test.com', password: 'password123' });
    signer2Token = signer2Login.body.token;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await MultiSigWallet.deleteMany({});
      await TransactionApproval.deleteMany({});
      await User.deleteMany({ email: { $in: ['owner@test.com', 'signer1@test.com', 'signer2@test.com'] } });
    }
  });

  describe('POST /api/wallets/multi-sig', () => {
    it('should create a multi-sig wallet with valid data', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/api/wallets/multi-sig')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Multi-Sig Wallet',
          cryptocurrency: 'BTC',
          address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          signers: [
            { email: 'signer1@test.com' },
            { email: 'signer2@test.com' }
          ],
          requiredSignatures: 2,
          description: 'Test wallet for development'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.name).toBe('Test Multi-Sig Wallet');
      expect(res.body.data.signers).toHaveLength(2);
      expect(res.body.data.requiredSignatures).toBe(2);

      walletId = res.body.data._id;
    });

    it('should return error for insufficient signers', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/api/wallets/multi-sig')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Wallet',
          cryptocurrency: 'ETH',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          signers: [
            { email: 'signer1@test.com' }
          ],
          requiredSignatures: 2
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/api/wallets/multi-sig')
        .send({
          name: 'Test Wallet',
          cryptocurrency: 'BTC',
          address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
          signers: [
            { email: 'signer1@test.com' },
            { email: 'signer2@test.com' }
          ],
          requiredSignatures: 2
        });

      expect(res.status).toBe(401);
    });

    it('should reject invalid Bitcoin address', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/api/wallets/multi-sig')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Invalid Address',
          cryptocurrency: 'BTC',
          address: 'invalid-bitcoin-address',
          signers: [
            { email: 'signer1@test.com' },
            { email: 'signer2@test.com' }
          ],
          requiredSignatures: 2,
          description: 'Testing invalid address'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid Bitcoin address');
    });

    it('should reject Ethereum address for BTC wallet', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/api/wallets/multi-sig')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Wrong Address Type',
          cryptocurrency: 'BTC',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          signers: [
            { email: 'signer1@test.com' },
            { email: 'signer2@test.com' }
          ],
          requiredSignatures: 2,
          description: 'Testing Ethereum address for BTC'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid Bitcoin address');
    });

    it('should accept valid P2SH Bitcoin address', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/api/wallets/multi-sig')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test P2SH Wallet',
          cryptocurrency: 'BTC',
          address: '3Ai1JZ8pdJb2ksieUV8FsxSNVJCpoPi8W6',
          signers: [
            { email: 'signer1@test.com' },
            { email: 'signer2@test.com' }
          ],
          requiredSignatures: 2,
          description: 'Testing P2SH address'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.address).toBe('3Ai1JZ8pdJb2ksieUV8FsxSNVJCpoPi8W6');
    });

    it('should accept valid Bech32 Bitcoin address', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/api/wallets/multi-sig')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Bech32 Wallet',
          cryptocurrency: 'BTC',
          address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          signers: [
            { email: 'signer1@test.com' },
            { email: 'signer2@test.com' }
          ],
          requiredSignatures: 2,
          description: 'Testing Bech32 address'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.address).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    });

    it('should not validate addresses for non-BTC cryptocurrencies', async () => {
      if (mongoose.connection.readyState !== 1) return;

      // For non-BTC cryptocurrencies, the Bitcoin address validation should not apply
      const res = await request(app)
        .post('/api/wallets/multi-sig')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test ETH Wallet',
          cryptocurrency: 'ETH',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          signers: [
            { email: 'signer1@test.com' },
            { email: 'signer2@test.com' }
          ],
          requiredSignatures: 2,
          description: 'Testing ETH address'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/wallets/multi-sig', () => {
    it('should get all wallets for user', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .get('/api/wallets/multi-sig')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should get wallets where user is a signer', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .get('/api/wallets/multi-sig')
        .set('Authorization', `Bearer ${signer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/wallets/multi-sig/:id', () => {
    it('should get wallet by ID', async () => {
      if (mongoose.connection.readyState !== 1 || !walletId) return;

      const res = await request(app)
        .get(`/api/wallets/multi-sig/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(walletId);
    });

    it('should not allow unauthorized access', async () => {
      if (mongoose.connection.readyState !== 1 || !walletId) return;

      // Create another user
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@test.com',
        password: 'password123'
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'other@test.com', password: 'password123' });

      const res = await request(app)
        .get(`/api/wallets/multi-sig/${walletId}`)
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(res.status).toBe(403);

      await User.findByIdAndDelete(otherUser._id);
    });
  });

  describe('POST /api/wallets/multi-sig/transactions', () => {
    it('should create a transaction approval request', async () => {
      if (mongoose.connection.readyState !== 1 || !walletId) return;

      const res = await request(app)
        .post('/api/wallets/multi-sig/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletId: walletId,
          amount: 0.5,
          toAddress: '1BitcoinEaterAddressDontSendf59kuE',
          description: 'Test transaction'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.requiredApprovals).toBe(2);

      transactionId = res.body.data._id;
    });
  });

  describe('POST /api/wallets/multi-sig/transactions/:id/approve', () => {
    it('should allow signer to approve transaction', async () => {
      if (mongoose.connection.readyState !== 1 || !transactionId) return;

      const res = await request(app)
        .post(`/api/wallets/multi-sig/transactions/${transactionId}/approve`)
        .set('Authorization', `Bearer ${signer1Token}`)
        .send({
          approved: true,
          comment: 'Looks good'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.approvals).toHaveLength(1);
      expect(res.body.data.status).toBe('pending');
    });

    it('should change status to approved when all signatures collected', async () => {
      if (mongoose.connection.readyState !== 1 || !transactionId) return;

      const res = await request(app)
        .post(`/api/wallets/multi-sig/transactions/${transactionId}/approve`)
        .set('Authorization', `Bearer ${signer2Token}`)
        .send({
          approved: true,
          comment: 'Approved'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.approvals).toHaveLength(2);
      expect(res.body.data.status).toBe('approved');
    });

    it('should not allow duplicate approvals', async () => {
      if (mongoose.connection.readyState !== 1 || !transactionId) return;

      const res = await request(app)
        .post(`/api/wallets/multi-sig/transactions/${transactionId}/approve`)
        .set('Authorization', `Bearer ${signer1Token}`)
        .send({
          approved: true
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/wallets/multi-sig/:id', () => {
    it('should allow owner to update wallet', async () => {
      if (mongoose.connection.readyState !== 1 || !walletId) return;

      const res = await request(app)
        .put(`/api/wallets/multi-sig/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Wallet Name',
          description: 'Updated description'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Wallet Name');
    });

    it('should not allow signer to update wallet', async () => {
      if (mongoose.connection.readyState !== 1 || !walletId) return;

      const res = await request(app)
        .put(`/api/wallets/multi-sig/${walletId}`)
        .set('Authorization', `Bearer ${signer1Token}`)
        .send({
          name: 'Unauthorized Update'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/wallets/multi-sig/:id/signers', () => {
    it('should allow owner to add signer', async () => {
      if (mongoose.connection.readyState !== 1 || !walletId) return;

      // Create new user
      const newSigner = await User.create({
        name: 'New Signer',
        email: 'newsigner@test.com',
        password: 'password123'
      });

      const res = await request(app)
        .post(`/api/wallets/multi-sig/${walletId}/signers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'newsigner@test.com'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.signers).toHaveLength(3);

      await User.findByIdAndDelete(newSigner._id);
    });
  });

  describe('DELETE /api/wallets/multi-sig/:id', () => {
    it('should allow owner to deactivate wallet', async () => {
      if (mongoose.connection.readyState !== 1 || !walletId) return;

      const res = await request(app)
        .delete(`/api/wallets/multi-sig/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify wallet is deactivated
      const wallet = await MultiSigWallet.findById(walletId);
      expect(wallet.isActive).toBe(false);
    });
  });
});
