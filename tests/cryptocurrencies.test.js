const {
  verifyLitecoinTransaction,
  verifyXRPTransaction,
  getCryptoPrice
} = require('../src/services/blockchainService');

describe('Additional Cryptocurrency Support', () => {
  describe('Litecoin (LTC) Support', () => {
    it('should handle LTC transaction verification gracefully', async () => {
      const result = await verifyLitecoinTransaction(
        'invalid-tx-hash',
        'LTC1qxy2kgdygjrsqtzq2n0yrf2493p83kkf0000000',
        0.1
      );
      
      expect(result).toHaveProperty('verified');
      expect(result.verified).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('XRP (Ripple) Support', () => {
    it('should handle XRP transaction verification gracefully', async () => {
      const result = await verifyXRPTransaction(
        'invalid-tx-hash',
        'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXEZv',
        100
      );
      
      expect(result).toHaveProperty('verified');
      expect(result.verified).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('Cryptocurrency Price Support', () => {
    it('should fetch BTC price', async () => {
      const price = await getCryptoPrice('BTC');
      expect(typeof price).toBe('number');
    });

    it('should fetch ETH price', async () => {
      const price = await getCryptoPrice('ETH');
      expect(typeof price).toBe('number');
    });

    it('should fetch USDT price', async () => {
      const price = await getCryptoPrice('USDT');
      expect(typeof price).toBe('number');
    });

    it('should fetch LTC price', async () => {
      const price = await getCryptoPrice('LTC');
      expect(typeof price).toBe('number');
    });

    it('should fetch XRP price', async () => {
      const price = await getCryptoPrice('XRP');
      expect(typeof price).toBe('number');
    });

    it('should handle invalid cryptocurrency symbol', async () => {
      const price = await getCryptoPrice('INVALID');
      expect(price).toBe(0);
    });
  });

  describe('Model Validation', () => {
    it('should accept LTC as valid cryptocurrency in orders', () => {
      const Order = require('../src/models/Order');
      const validCurrencies = Order.schema.path('cryptocurrency').enumValues;
      expect(validCurrencies).toContain('LTC');
    });

    it('should accept XRP as valid cryptocurrency in orders', () => {
      const Order = require('../src/models/Order');
      const validCurrencies = Order.schema.path('cryptocurrency').enumValues;
      expect(validCurrencies).toContain('XRP');
    });

    it('should accept LTC in products', () => {
      const Product = require('../src/models/Product');
      const validCurrencies = Product.schema.path('currency').enumValues;
      expect(validCurrencies).toContain('LTC');
    });

    it('should accept XRP in products', () => {
      const Product = require('../src/models/Product');
      const validCurrencies = Product.schema.path('currency').enumValues;
      expect(validCurrencies).toContain('XRP');
    });

    it('should accept LTC in payments', () => {
      const Payment = require('../src/models/Payment');
      const validCurrencies = Payment.schema.path('cryptocurrency').enumValues;
      expect(validCurrencies).toContain('LTC');
    });

    it('should accept XRP in payments', () => {
      const Payment = require('../src/models/Payment');
      const validCurrencies = Payment.schema.path('cryptocurrency').enumValues;
      expect(validCurrencies).toContain('XRP');
    });
  });
});
