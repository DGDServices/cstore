jest.mock('axios', () => ({
  get: jest.fn()
}));

const axios = require('axios');

const loadService = () => {
  const service = require('../src/services/cfvService');
  service.priceCache.clear();
  service.calculationCache.clear();
  return service;
};

describe('CFV Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CFV_ENABLED = 'true';
    process.env.CFV_CACHE_TTL = '300';
    process.env.CFV_METRICS_API_URL = 'http://cfv-agent.local';
  });

  test('should return 12 supported DGF CFV coins', () => {
    const cfvService = loadService();
    expect(cfvService.getSupportedCFVCoins()).toHaveLength(12);
    expect(cfvService.getSupportedCFVCoins().map(coin => coin.symbol)).toContain('DGD');
  });

  test('should parse CFV API response and calculate valuation status', async () => {
    const cfvService = loadService();
    axios.get.mockResolvedValue({
      data: {
        data: {
          currentPrice: 2,
          fairValue: 3,
          cfv: 1000000,
          metrics: {
            adoption: 1000,
            annualTransactions: 2000,
            annualTransactionValue: 3000,
            developers: 10,
            circulatingSupply: 500000
          },
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      }
    });

    const result = await cfvService.getCFVForCoin('dgb');
    expect(result.symbol).toBe('DGB');
    expect(result.currentPrice).toBe(2);
    expect(result.fairValue).toBe(3);
    expect(result.valuationStatus).toBe('undervalued');
    expect(result.percentageDifference).toBe(50);
    expect(result.metrics.circulatingSupply).toBe(500000);
  });

  test('should use cache for repeated requests', async () => {
    const cfvService = loadService();
    axios.get.mockResolvedValue({
      data: {
        data: {
          currentPrice: 1,
          fairValue: 1,
          metrics: { circulatingSupply: 1000 }
        }
      }
    });

    await cfvService.getCFVForCoin('XMR');
    await cfvService.getCFVForCoin('XMR');

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('should reject unsupported symbol', async () => {
    const cfvService = loadService();
    await expect(cfvService.getCFVForCoin('DOGE')).rejects.toMatchObject({
      statusCode: 400
    });
  });
});
