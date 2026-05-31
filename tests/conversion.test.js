const mongoose = require('mongoose');
const ConversionTransaction = require('../src/models/ConversionTransaction');
const PrintifyOrder = require('../src/models/PrintifyOrder');
const ExchangeBalance = require('../src/models/ExchangeBalance');
const RateCalculator = require('../src/utils/rateCalculator');
const RiskCalculator = require('../src/utils/riskCalculator');

describe('Conversion System Tests', () => {
  beforeEach(() => {
    if (!global.isConnected()) {
      console.log('Skipping conversion tests - no database connection');
    }
  });

  describe('ConversionTransaction Model', () => {
    test('should create a conversion transaction', async () => {
      if (!global.isConnected()) return;

      const conversion = await ConversionTransaction.create({
        order: new mongoose.Types.ObjectId(),
        cryptoAmount: 0.001,
        cryptocurrency: 'BTC',
        fiatAmount: 45.50,
        fiatCurrency: 'USD',
        exchangeRate: 45500,
        exchange: 'coinbase',
        status: 'pending',
        fees: {
          exchangeFee: 0.27,
          networkFee: 0.10,
          processingFee: 0.23
        },
        riskLevel: 'low',
        requiresApproval: false
      });

      expect(conversion).toHaveProperty('_id');
      expect(conversion.cryptoAmount).toBe(0.001);
      expect(conversion.cryptocurrency).toBe('BTC');
      expect(conversion.fiatAmount).toBe(45.50);
      expect(conversion.exchange).toBe('coinbase');
      expect(conversion.status).toBe('pending');
    });

    test('should calculate total fees correctly', async () => {
      if (!global.isConnected()) return;

      const conversion = await ConversionTransaction.create({
        order: new mongoose.Types.ObjectId(),
        cryptoAmount: 1.0,
        cryptocurrency: 'ETH',
        fiatAmount: 2000,
        fiatCurrency: 'USD',
        exchangeRate: 2000,
        exchange: 'kraken',
        fees: {
          exchangeFee: 5.20,
          networkFee: 2.50,
          processingFee: 10.00
        }
      });

      expect(conversion.totalFees).toBe(17.70);
    });

    test('should calculate net fiat amount correctly', async () => {
      if (!global.isConnected()) return;

      const conversion = await ConversionTransaction.create({
        order: new mongoose.Types.ObjectId(),
        cryptoAmount: 1.0,
        cryptocurrency: 'ETH',
        fiatAmount: 2000,
        fiatCurrency: 'USD',
        exchangeRate: 2000,
        exchange: 'kraken',
        fees: {
          exchangeFee: 5.20,
          networkFee: 2.50,
          processingFee: 10.00
        }
      });

      expect(conversion.netFiatAmount).toBe(1982.30);
    });

    test('should update status with history', async () => {
      if (!global.isConnected()) return;

      const conversion = await ConversionTransaction.create({
        order: new mongoose.Types.ObjectId(),
        cryptoAmount: 0.5,
        cryptocurrency: 'LTC',
        fiatAmount: 50,
        fiatCurrency: 'USD',
        exchangeRate: 100,
        exchange: 'binance'
      });

      await conversion.updateStatus('converting', 'Starting conversion');
      await conversion.updateStatus('completed', 'Conversion successful');

      expect(conversion.status).toBe('completed');
      expect(conversion.statusHistory).toHaveLength(2);
      expect(conversion.completedAt).toBeDefined();
    });
  });

  describe('PrintifyOrder Model', () => {
    test('should create a Printify order', async () => {
      if (!global.isConnected()) return;

      const printifyOrder = await PrintifyOrder.create({
        originalOrder: new mongoose.Types.ObjectId(),
        conversion: new mongoose.Types.ObjectId(),
        products: [{
          printifyProductId: 'prod_123',
          variantId: 'var_456',
          quantity: 2,
          price: 25.00,
          productName: 'T-Shirt'
        }],
        shippingInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          address1: '123 Main St',
          city: 'New York',
          zip: '10001',
          country: 'US'
        },
        status: 'pending',
        totalCost: 50.00
      });

      expect(printifyOrder).toHaveProperty('_id');
      expect(printifyOrder.products).toHaveLength(1);
      expect(printifyOrder.status).toBe('pending');
      expect(printifyOrder.totalCost).toBe(50.00);
    });

    test('should update order status', async () => {
      if (!global.isConnected()) return;

      const printifyOrder = await PrintifyOrder.create({
        originalOrder: new mongoose.Types.ObjectId(),
        conversion: new mongoose.Types.ObjectId(),
        products: [],
        shippingInfo: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          address1: '456 Oak Ave',
          city: 'Los Angeles',
          zip: '90001',
          country: 'US'
        },
        totalCost: 75.00
      });

      await printifyOrder.updateStatus('ready', 'Ready for placement');
      await printifyOrder.updateStatus('placed', 'Placed with Printify');

      expect(printifyOrder.status).toBe('placed');
      expect(printifyOrder.statusHistory).toHaveLength(2);
      expect(printifyOrder.placedAt).toBeDefined();
    });
  });

  describe('ExchangeBalance Model', () => {
    test('should create an exchange balance', async () => {
      if (!global.isConnected()) return;

      const balance = await ExchangeBalance.create({
        exchange: 'coinbase',
        currency: 'BTC',
        currencyType: 'crypto',
        available: 1.5,
        reserved: 0.2,
        total: 1.7
      });

      expect(balance).toHaveProperty('_id');
      expect(balance.exchange).toBe('coinbase');
      expect(balance.currency).toBe('BTC');
      expect(balance.available).toBe(1.5);
    });

    test('should update balance correctly', async () => {
      if (!global.isConnected()) return;

      const balance = await ExchangeBalance.create({
        exchange: 'kraken',
        currency: 'ETH',
        currencyType: 'crypto',
        available: 10,
        reserved: 0,
        total: 10
      });

      await balance.updateBalance(8, 2, 10);

      expect(balance.available).toBe(8);
      expect(balance.reserved).toBe(2);
      expect(balance.total).toBe(10);
    });

    test('should reserve and release balance', async () => {
      if (!global.isConnected()) return;

      const balance = await ExchangeBalance.create({
        exchange: 'binance',
        currency: 'USDT',
        currencyType: 'crypto',
        available: 1000,
        reserved: 0,
        total: 1000
      });

      await balance.reserve(200);
      expect(balance.available).toBe(800);
      expect(balance.reserved).toBe(200);

      await balance.release(100);
      expect(balance.available).toBe(900);
      expect(balance.reserved).toBe(100);
    });
  });

  describe('RateCalculator', () => {
    test('should calculate rate with spread', () => {
      const baseRate = 1000;
      const spread = 1; // 1%
      const rateWithSpread = RateCalculator.calculateRateWithSpread(baseRate, spread);
      
      expect(rateWithSpread).toBe(1010);
    });

    test('should calculate fiat amount from crypto', () => {
      const cryptoAmount = 0.5;
      const rate = 2000;
      const fiatAmount = RateCalculator.calculateFiatAmount(cryptoAmount, rate);
      
      expect(fiatAmount).toBe(1000);
    });

    test('should calculate exchange fee', () => {
      const amount = 1000;
      const exchange = 'coinbase';
      const fee = RateCalculator.calculateExchangeFee(amount, exchange, true);
      
      expect(fee).toBeGreaterThan(0);
      expect(fee).toBe(6); // 0.6% taker fee
    });

    test('should calculate processing fee', () => {
      const amount = 1000;
      const fee = RateCalculator.calculateProcessingFee(amount);
      
      expect(fee).toBeGreaterThan(0);
    });

    test('should calculate slippage', () => {
      const expectedRate = 1000;
      const actualRate = 1020;
      const slippage = RateCalculator.calculateSlippage(expectedRate, actualRate);
      
      expect(slippage).toBe(2);
    });

    test('should validate amount within limits', () => {
      const result1 = RateCalculator.validateAmount(50);
      expect(result1.valid).toBe(true);

      const result2 = RateCalculator.validateAmount(5); // Below minimum
      expect(result2.valid).toBe(false);

      const result3 = RateCalculator.validateAmount(50000); // Above maximum
      expect(result3.valid).toBe(false);
    });
  });

  describe('RiskCalculator', () => {
    test('should calculate amount risk', () => {
      const lowRisk = RiskCalculator.calculateAmountRisk(100);
      expect(lowRisk).toBeLessThan(30);

      const highRisk = RiskCalculator.calculateAmountRisk(9000);
      expect(highRisk).toBeGreaterThan(30);
    });

    test('should calculate volatility risk', () => {
      const lowVolatility = RiskCalculator.calculateVolatilityRisk(2);
      expect(lowVolatility).toBeLessThan(30);

      const highVolatility = RiskCalculator.calculateVolatilityRisk(10);
      expect(highVolatility).toBeGreaterThan(30);
    });

    test('should determine risk level from score', () => {
      expect(RiskCalculator.determineRiskLevel(20)).toBe('low');
      expect(RiskCalculator.determineRiskLevel(45)).toBe('medium');
      expect(RiskCalculator.determineRiskLevel(75)).toBe('high');
    });

    test('should check if approval required', () => {
      const result1 = RiskCalculator.requiresApproval(500, 'low');
      expect(result1.required).toBe(false);

      const result2 = RiskCalculator.requiresApproval(5000, 'medium');
      expect(result2.required).toBe(true);

      const result3 = RiskCalculator.requiresApproval(500, 'high');
      expect(result3.required).toBe(true);
    });
  });
});
