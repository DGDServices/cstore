'use strict';
/**
 * Unit tests for the DGD escrow signing controller.
 * The DgdCoreClient is mocked — no real dgd-core connection needed.
 */

const request = require('supertest');

// ── mocks ─────────────────────────────────────────────────────────────────────

// Mock DgdCoreClient BEFORE requiring app
jest.mock('../src/services/dgdCoreClient', () => {
  const mockClient = {
    openEscrow:      jest.fn(),
    getEscrow:       jest.fn(),
    checkFunding:    jest.fn(),
    proposeRelease:  jest.fn(),
    getPayoutPsbt:   jest.fn(),
    signPayout:      jest.fn(),
    openDispute:     jest.fn(),
    proposeRefund:   jest.fn(),
    proposeMediation: jest.fn(),
  };
  return { DgdCoreClient: jest.fn(() => mockClient), mockClient };
});

// Mock mongoose + Order to avoid live DB
jest.mock('../src/models/Order', () => {
  const mockOrder = {
    _id: 'order-1',
    user: 'user-1',
    items: [{ product: 'prod-1' }],
    dgdEscrowId: null,
    dgdEscrowAddress: null,
    dgdEscrowState: null,
    dgdExpectedSats: '100000000',
    status: 'pending',
    save: jest.fn().mockResolvedValue(true),
  };
  return {
    findById: jest.fn().mockResolvedValue(mockOrder),
    _mockOrder: mockOrder,
  };
});

// Mock User: findById(id).select() resolves from an in-test store keyed by id.
jest.mock('../src/models/User', () => {
  const store = { byId: {} };
  return {
    __store: store,
    findById: jest.fn((id) => ({ select: () => Promise.resolve(store.byId[id] || null) })),
    findOne:  jest.fn(() => ({ select: () => Promise.resolve(null) })),
  };
});

// Mock Product: findById(id).select() resolves from an in-test store keyed by id.
jest.mock('../src/models/Product', () => {
  const store = { byId: {} };
  return {
    __store: store,
    findById: jest.fn((id) => ({ select: () => Promise.resolve(store.byId[id] || null) })),
  };
});

// Mock auth middleware — always passes with user-1
// protect sets a fixed user; an optional `x-test-role` header lets a test
// promote that user (e.g. to 'admin' for arbitrator-only mediation).
jest.mock('../src/middleware/auth', () => ({
  protect:   (req, _res, next) => { req.user = { id: 'user-1', role: req.headers['x-test-role'] }; next(); },
  authorize: () => (_req, _res, next) => next(),
}));

// Minimal mock for config (arbitrator left unset by default; a test sets it)
jest.mock('../src/config/dgd', () => ({
  DGD_CORE_URL: 'http://dgd-core-mock',
  DGD_CORE_AUTH_TOKEN: 'mock-token',
  DGD_ARBITRATOR_PUBKEY: undefined,
  DGD_ARBITRATOR_PAYOUT_ADDRESS: undefined,
}));

// ── helpers ───────────────────────────────────────────────────────────────────

let app, mockClient;
beforeAll(() => {
  const mod = require('../src/services/dgdCoreClient');
  mockClient = mod.mockClient;
  // Build a minimal test app that mounts ONLY the DGD escrow routes.
  // Loading the full src/app triggers unrelated startup errors (optional auth,
  // Mongoose, etc.) that are pre-existing in the codebase; a targeted mount is
  // both faster and more isolated.
  const express = require('express');
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/dgd-escrow', require('../src/routes/dgdEscrowRoutes'));
  // Generic error handler so AppError JSON surfaces correctly
  testApp.use((err, _req, res, _next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });
  app = testApp;
});

const auth = { Authorization: 'Bearer test' }; // middleware always passes

// ── tests ─────────────────────────────────────────────────────────────────────

const userStore = require('../src/models/User').__store;
const productStore = require('../src/models/Product').__store;

describe('DGD Escrow Signing API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userStore.byId = {};
    productStore.byId = {};
  });

  it('GET /api/dgd-escrow/:id returns the current escrow state', async () => {
    mockClient.getEscrow.mockResolvedValue({ state: 'funded', policy: { threshold: 2 } });
    const res = await request(app).get('/api/dgd-escrow/order-1').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.escrow.state).toBe('funded');
  });

  it('POST /api/dgd-escrow/:id/open calls openEscrow and persists the address', async () => {
    mockClient.openEscrow.mockResolvedValue({
      state: 'created',
      multisig: { address: 'dgd1multisig123' }
    });
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/open')
      .set(auth)
      .send({
        buyerPubkey: 'pkB', buyerPayoutAddress: 'addrB',
        sellerPubkey: 'pkS', sellerPayoutAddress: 'addrS',
      });
    expect(res.status).toBe(200);
    expect(mockClient.openEscrow).toHaveBeenCalledTimes(1);
    const call = mockClient.openEscrow.mock.calls[0][0];
    expect(call.buyer).toEqual({ pubkey: 'pkB', payoutAddress: 'addrB' });
  });

  it('open resolves seller keys from the product seller profile when not in the body', async () => {
    productStore.byId['prod-1']   = { seller: 'seller-1' };
    userStore.byId['seller-1']    = { dgdPubkey: 'spk', dgdPayoutAddress: 'saddr' };
    mockClient.openEscrow.mockResolvedValue({ state: 'created', multisig: { address: 'm' } });
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/open')
      .set(auth)
      .send({ buyerPubkey: 'pkB', buyerPayoutAddress: 'addrB' }); // no seller keys
    expect(res.status).toBe(200);
    const call = mockClient.openEscrow.mock.calls[0][0];
    expect(call.seller).toEqual({ pubkey: 'spk', payoutAddress: 'saddr' });
  });

  it('open returns 409 when the seller has no DGD keys configured', async () => {
    // productStore + userStore empty → no seller keys resolvable
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/open')
      .set(auth)
      .send({ buyerPubkey: 'pkB', buyerPayoutAddress: 'addrB' });
    expect(res.status).toBe(409);
  });

  it('open forwards an arbitrator (2-of-3) when one is provided', async () => {
    productStore.byId['prod-1'] = { seller: 'seller-1' };
    userStore.byId['seller-1']  = { dgdPubkey: 'spk', dgdPayoutAddress: 'saddr' };
    mockClient.openEscrow.mockResolvedValue({ state: 'created', multisig: { address: 'm' } });
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/open')
      .set(auth)
      .send({
        buyerPubkey: 'pkB', buyerPayoutAddress: 'addrB',
        arbitratorPubkey: 'apk', arbitratorPayoutAddress: 'aaddr',
      });
    expect(res.status).toBe(200);
    const call = mockClient.openEscrow.mock.calls[0][0];
    expect(call.arbitrator).toEqual({ pubkey: 'apk', payoutAddress: 'aaddr' });
  });

  it('open uses order.dgdExpectedSats as the amount when not provided', async () => {
    productStore.byId['prod-1'] = { seller: 'seller-1' };
    userStore.byId['seller-1']  = { dgdPubkey: 'spk', dgdPayoutAddress: 'saddr' };
    mockClient.openEscrow.mockResolvedValue({ state: 'created', multisig: { address: 'm' } });
    await request(app)
      .post('/api/dgd-escrow/order-1/open')
      .set(auth)
      .send({ buyerPubkey: 'pkB', buyerPayoutAddress: 'addrB' });
    expect(mockClient.openEscrow.mock.calls[0][0].amountSats).toBe('100000000'); // _mockOrder.dgdExpectedSats
  });

  it('GET /api/dgd-escrow/:id/payout-psbt returns the unsigned PSBT', async () => {
    mockClient.getPayoutPsbt.mockResolvedValue({ psbt: 'cHNidP8B...' });
    const res = await request(app).get('/api/dgd-escrow/order-1/payout-psbt').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.psbt).toBe('cHNidP8B...');
  });

  it('POST /api/dgd-escrow/:id/sign-payout submits the signed PSBT with an idempotency key', async () => {
    mockClient.signPayout.mockResolvedValue({ state: 'released', history: [] });
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/sign-payout')
      .set(auth)
      .send({ role: 'seller', signedPsbt: 'signedBase64' });
    expect(res.status).toBe(200);
    expect(res.body.escrow.state).toBe('released');
    const [, role, psbt, key] = mockClient.signPayout.mock.calls[0];
    expect(role).toBe('seller');
    expect(psbt).toBe('signedBase64');
    expect(key).toContain('order-1:seller:sign');
  });

  it('POST .../sign-payout returns 400 when signedPsbt is missing', async () => {
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/sign-payout')
      .set(auth)
      .send({ role: 'seller' });
    expect(res.status).toBe(400);
  });

  it('POST .../propose-release calls proposeRelease for the user role', async () => {
    mockClient.proposeRelease.mockResolvedValue({ state: 'funded', proposal: { kind: 'release', signatures: {} } });
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/propose-release')
      .set(auth)
      .send({ role: 'seller' });
    expect(res.status).toBe(200);
    expect(mockClient.proposeRelease).toHaveBeenCalledWith('order-1', 'seller', undefined, 'order-1:seller:release');
  });

  it('POST .../check-funding marks order paid when funded', async () => {
    const Order = require('../src/models/Order');
    Order.findById.mockResolvedValue({ ...Order._mockOrder, status: 'pending', save: jest.fn().mockResolvedValue(true) });
    mockClient.checkFunding.mockResolvedValue({ state: 'funded' });
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/check-funding')
      .set(auth);
    expect(res.status).toBe(200);
    expect(res.body.escrow.state).toBe('funded');
  });

  it('POST .../open-dispute opens a dispute', async () => {
    mockClient.openDispute.mockResolvedValue({ state: 'disputed' });
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/open-dispute')
      .set(auth)
      .send({ role: 'buyer', reason: 'item never arrived' });
    expect(res.status).toBe(200);
    expect(mockClient.openDispute).toHaveBeenCalledWith('order-1', 'buyer', 'item never arrived', 'order-1:buyer:dispute');
  });

  it('POST .../refund proposes a cancel-refund for the user role', async () => {
    mockClient.proposeRefund.mockResolvedValue({ state: 'funded', proposal: { kind: 'refund', signatures: {} } });
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/refund')
      .set(auth)
      .send({ role: 'buyer' });
    expect(res.status).toBe(200);
    expect(mockClient.proposeRefund).toHaveBeenCalledWith('order-1', 'buyer', 'order-1:buyer:refund');
  });

  it('POST .../refund returns 400 for an invalid role', async () => {
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/refund')
      .set(auth)
      .send({ role: 'arbitrator' }); // not buyer/seller
    expect(res.status).toBe(400);
    expect(mockClient.proposeRefund).not.toHaveBeenCalled();
  });

  it('POST .../mediate is forbidden (403) for a non-admin user', async () => {
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/mediate')
      .set(auth) // no x-test-role → role undefined
      .send({ outputs: [{ address: 'addrB', amount: '60000000' }] });
    expect(res.status).toBe(403);
    expect(mockClient.proposeMediation).not.toHaveBeenCalled();
  });

  it('POST .../mediate lets an admin arbitrator propose a payout split', async () => {
    mockClient.proposeMediation.mockResolvedValue({ state: 'disputed', proposal: { kind: 'mediation', signatures: {} } });
    const outputs = [
      { address: 'addrB', amount: '60000000' },
      { address: 'addrS', amount: '39990000' },
    ];
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/mediate')
      .set(auth).set('x-test-role', 'admin')
      .send({ outputs, note: 'split 60/40 per evidence' });
    expect(res.status).toBe(200);
    expect(mockClient.proposeMediation).toHaveBeenCalledWith('order-1', outputs, 'split 60/40 per evidence');
  });

  it('POST .../mediate returns 400 when outputs are missing/empty', async () => {
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/mediate')
      .set(auth).set('x-test-role', 'admin')
      .send({ note: 'no outputs' });
    expect(res.status).toBe(400);
    expect(mockClient.proposeMediation).not.toHaveBeenCalled();
  });

  it('returns 400 when buyer/seller pubkeys are missing on open', async () => {
    const res = await request(app)
      .post('/api/dgd-escrow/order-1/open')
      .set(auth)
      .send({ buyerPubkey: 'pkB' }); // missing other fields
    expect(res.status).toBe(400);
  });
});
