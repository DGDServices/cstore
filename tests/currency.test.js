const mongoose = require('mongoose');
const currencyService = require('../src/services/currencyService');
const CurrencyRate = require('../src/models/CurrencyRate');

describe('Currency Service Tests', () => {
  // Skip tests if not connected to database
  beforeEach(() => {
    if (!global.isConnected()) {
      console.log('Skipping currency tests - no database connection');
    }
  });

  describe('Currency Conversion', () => {
    test('should convert USD to EUR', async () => {
      if (!global.isConnected()) return;

      // Create a test rate
      await CurrencyRate.create({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
        source: 'manual',
        isActive: true
      });

      const result = await currencyService.convertCurrency(100, 'USD', 'EUR');
      
      expect(result).toHaveProperty('originalAmount', 100);
      expect(result).toHaveProperty('originalCurrency', 'USD');
      expect(result).toHaveProperty('convertedAmount', 85);
      expect(result).toHaveProperty('targetCurrency', 'EUR');
      expect(result).toHaveProperty('exchangeRate', 0.85);
    });

    test('should handle same currency conversion', async () => {
      if (!global.isConnected()) return;

      const result = await currencyService.convertCurrency(100, 'USD', 'USD');
      
      expect(result.convertedAmount).toBe(100);
      expect(result.exchangeRate).toBe(1);
    });

    test('should round JPY to no decimals', async () => {
      if (!global.isConnected()) return;

      await CurrencyRate.create({
        baseCurrency: 'USD',
        targetCurrency: 'JPY',
        rate: 110.567,
        source: 'manual',
        isActive: true
      });

      const result = await currencyService.convertCurrency(100, 'USD', 'JPY');
      
      expect(result.convertedAmount).toBe(11057);
      expect(Number.isInteger(result.convertedAmount)).toBe(true);
    });

    test('should round EUR to 2 decimals', async () => {
      if (!global.isConnected()) return;

      await CurrencyRate.create({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.856789,
        source: 'manual',
        isActive: true
      });

      const result = await currencyService.convertCurrency(100, 'USD', 'EUR');
      
      expect(result.convertedAmount).toBe(85.68);
    });
  });

  describe('Currency Rounding', () => {
    test('should round JPY with no decimals', () => {
      const rounded = currencyService.roundCurrency(11057.89, 'JPY');
      expect(rounded).toBe(11058);
    });

    test('should round USD with 2 decimals', () => {
      const rounded = currencyService.roundCurrency(123.456, 'USD');
      expect(rounded).toBe(123.46);
    });

    test('should round EUR with 2 decimals', () => {
      const rounded = currencyService.roundCurrency(99.999, 'EUR');
      expect(rounded).toBe(100);
    });
  });

  describe('Supported Currencies', () => {
    test('should return list of supported currencies', () => {
      const currencies = currencyService.getSupportedCurrencies();
      
      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(0);
      
      const usd = currencies.find(c => c.code === 'USD');
      expect(usd).toHaveProperty('code', 'USD');
      expect(usd).toHaveProperty('name', 'US Dollar');
      expect(usd).toHaveProperty('symbol', '$');
      expect(usd).toHaveProperty('decimals', 2);
    });

    test('should include major currencies', () => {
      const currencies = currencyService.getSupportedCurrencies();
      const codes = currencies.map(c => c.code);
      
      expect(codes).toContain('USD');
      expect(codes).toContain('EUR');
      expect(codes).toContain('GBP');
      expect(codes).toContain('JPY');
      expect(codes).toContain('CAD');
    });
  });

  describe('Currency Names and Symbols', () => {
    test('should get currency name', () => {
      expect(currencyService.getCurrencyName('USD')).toBe('US Dollar');
      expect(currencyService.getCurrencyName('EUR')).toBe('Euro');
      expect(currencyService.getCurrencyName('GBP')).toBe('British Pound');
    });

    test('should get currency symbol', () => {
      expect(currencyService.getCurrencySymbol('USD')).toBe('$');
      expect(currencyService.getCurrencySymbol('EUR')).toBe('€');
      expect(currencyService.getCurrencySymbol('GBP')).toBe('£');
      expect(currencyService.getCurrencySymbol('JPY')).toBe('¥');
    });
  });

  describe('Exchange Rate Management', () => {
    test('should get exchange rate from database', async () => {
      if (!global.isConnected()) return;

      await CurrencyRate.create({
        baseCurrency: 'USD',
        targetCurrency: 'GBP',
        rate: 0.75,
        source: 'manual',
        isActive: true,
        lastUpdated: new Date()
      });

      const rate = await currencyService.getExchangeRate('USD', 'GBP');
      expect(rate).toBe(0.75);
    });

    test('should return 1 for same currency', async () => {
      if (!global.isConnected()) return;

      const rate = await currencyService.getExchangeRate('USD', 'USD');
      expect(rate).toBe(1);
    });
  });

  describe('CurrencyRate Model', () => {
    test('should create currency rate', async () => {
      if (!global.isConnected()) return;

      const rate = await CurrencyRate.create({
        baseCurrency: 'USD',
        targetCurrency: 'CAD',
        rate: 1.25,
        source: 'api',
        isActive: true
      });

      expect(rate).toHaveProperty('baseCurrency', 'USD');
      expect(rate).toHaveProperty('targetCurrency', 'CAD');
      expect(rate).toHaveProperty('rate', 1.25);
      expect(rate).toHaveProperty('source', 'api');
    });

    test('should get latest rate', async () => {
      if (!global.isConnected()) return;

      // Create older rate
      await CurrencyRate.create({
        baseCurrency: 'USD',
        targetCurrency: 'AUD',
        rate: 1.30,
        source: 'api',
        isActive: true,
        lastUpdated: new Date('2024-01-01')
      });

      // Create newer rate
      await CurrencyRate.create({
        baseCurrency: 'USD',
        targetCurrency: 'AUD',
        rate: 1.35,
        source: 'api',
        isActive: true,
        lastUpdated: new Date()
      });

      const latestRate = await CurrencyRate.getLatestRate('USD', 'AUD');
      expect(latestRate.rate).toBe(1.35);
    });
  });
});
