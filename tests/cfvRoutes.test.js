const request = require('supertest');

jest.mock('../src/services/cfvService', () => ({
  getAllCFVCoins: jest.fn(),
  getCFVForCoin: jest.fn(),
  getCoinValuationStatus: jest.fn()
}));

const cfvService = require('../src/services/cfvService');
const app = require('../src/app');

describe('CFV API Routes', () => {
  test('GET /api/cfv/coins returns all CFV coins', async () => {
    cfvService.getAllCFVCoins.mockResolvedValue([
      { symbol: 'DGB', name: 'DigiByte' },
      { symbol: 'DGD', name: 'Digital Gold' }
    ]);

    const res = await request(app).get('/api/cfv/coins');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.coins).toHaveLength(2);
  });

  test('GET /api/cfv/coins/:symbol returns detailed data', async () => {
    cfvService.getCFVForCoin.mockResolvedValue({
      symbol: 'DGB',
      name: 'DigiByte',
      currentPrice: 1,
      fairValue: 2
    });
    cfvService.getCoinValuationStatus.mockResolvedValue({
      symbol: 'DGB',
      status: 'undervalued',
      percentageDifference: 100
    });

    const res = await request(app).get('/api/cfv/coins/DGB');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.coin.symbol).toBe('DGB');
    expect(res.body.data.valuation.status).toBe('undervalued');
  });

  test('GET /api/cfv/summary returns summary totals', async () => {
    cfvService.getAllCFVCoins.mockResolvedValue([
      { symbol: 'DGB', name: 'DigiByte', valuationStatus: 'undervalued', currentPrice: 1, fairValue: 2, percentageDifference: 100 },
      { symbol: 'DASH', name: 'Dash', valuationStatus: 'overvalued', currentPrice: 3, fairValue: 2, percentageDifference: -33.33 },
      { symbol: 'DGD', name: 'Digital Gold', valuationStatus: 'fairly valued', currentPrice: 2, fairValue: 2, percentageDifference: 0 }
    ]);

    const res = await request(app).get('/api/cfv/summary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totals.undervalued).toBe(1);
    expect(res.body.data.totals.overvalued).toBe(1);
    expect(res.body.data.totals.fairlyValued).toBe(1);
  });
});
