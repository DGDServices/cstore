const request = require('supertest');
const app = require('../src/app');

describe('Cryptocurrency API', () => {
  describe('GET /api/cryptocurrencies', () => {
    it('should report DGD as the only settlement currency', async () => {
      const res = await request(app)
        .get('/api/cryptocurrencies');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cryptocurrencies).toEqual([{ symbol: 'DGD', name: 'Digital Gold' }]);
    });

    it('should not expose any platform payment address (non-custodial)', async () => {
      const res = await request(app)
        .get('/api/cryptocurrencies');

      expect(res.status).toBe(200);
      for (const coin of res.body.data.cryptocurrencies) {
        expect(coin.address).toBeUndefined();
      }
    });

    it('should be accessible without authentication', async () => {
      const res = await request(app)
        .get('/api/cryptocurrencies');

      expect(res.status).toBe(200);
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
