const request = require('supertest');
const app = require('../src/app');

describe('Cryptocurrency API', () => {
  const dgfSymbols = ['DGB', 'DASH', 'XMR', 'XNO', 'ZCL', 'RVN', 'XEC', 'EGLD', 'NEAR', 'ICP', 'XCH', 'DGD'];

  describe('GET /api/cryptocurrencies', () => {
    it('should get all supported cryptocurrencies', async () => {
      const res = await request(app)
        .get('/api/cryptocurrencies');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cryptocurrencies).toBeDefined();
      expect(Array.isArray(res.body.data.cryptocurrencies)).toBe(true);
      expect(res.body.data.cryptocurrencies.length).toBeGreaterThan(0);
    });

    it('should include BTC, ETH, and USDT', async () => {
      const res = await request(app)
        .get('/api/cryptocurrencies');

      expect(res.status).toBe(200);
      
      const symbols = res.body.data.cryptocurrencies.map(c => c.symbol);
      expect(symbols).toContain('BTC');
      expect(symbols).toContain('ETH');
      expect(symbols).toContain('USDT');
    });

    it('should include all 12 DGF CFV coins', async () => {
      const res = await request(app)
        .get('/api/cryptocurrencies');

      expect(res.status).toBe(200);

      const symbols = res.body.data.cryptocurrencies.map(c => c.symbol);
      dgfSymbols.forEach(symbol => {
        expect(symbols).toContain(symbol);
      });
    });

    it('should include cryptocurrency details', async () => {
      const res = await request(app)
        .get('/api/cryptocurrencies');

      expect(res.status).toBe(200);
      
      const btc = res.body.data.cryptocurrencies.find(c => c.symbol === 'BTC');
      expect(btc).toBeDefined();
      expect(btc.name).toBeDefined();
      expect(btc.address).toBeDefined();
      expect(btc.symbol).toBe('BTC');
    });

    it('should be accessible without authentication', async () => {
      const res = await request(app)
        .get('/api/cryptocurrencies');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/health', () => {
    it('should return health check status', async () => {
      const res = await request(app)
        .get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });

    it('should include environment information', async () => {
      const res = await request(app)
        .get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.environment).toBeDefined();
    });

    it('should be accessible without authentication', async () => {
      const res = await request(app)
        .get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return valid timestamp', async () => {
      const res = await request(app)
        .get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.timestamp).toBeDefined();
      
      const timestamp = new Date(res.body.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });
});
