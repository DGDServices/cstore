const mongoose = require('mongoose');
const RegionalPaymentMethod = require('../src/models/RegionalPaymentMethod');

describe('Regional Payment Methods Tests', () => {
  beforeEach(() => {
    if (!global.isConnected()) {
      console.log('Skipping regional payment tests - no database connection');
    }
  });

  describe('RegionalPaymentMethod Model', () => {
    test('should create payment method', async () => {
      if (!global.isConnected()) return;

      const method = await RegionalPaymentMethod.create({
        name: 'Test Payment',
        code: 'TEST',
        description: 'Test payment method',
        regions: ['EU'],
        countries: ['DE', 'FR'],
        currencies: ['EUR'],
        type: 'bank_transfer',
        processingTime: '1-2 days',
        fees: {
          fixed: 0,
          percentage: 0
        }
      });

      expect(method).toHaveProperty('name', 'Test Payment');
      expect(method).toHaveProperty('code', 'TEST');
      expect(method.regions).toContain('EU');
      expect(method.countries).toContain('DE');
      expect(method.currencies).toContain('EUR');
    });

    test('should require name and code', async () => {
      if (!global.isConnected()) return;

      try {
        await RegionalPaymentMethod.create({
          description: 'Missing required fields'
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
      }
    });

    test('should enforce unique code', async () => {
      if (!global.isConnected()) return;

      await RegionalPaymentMethod.create({
        name: 'First Method',
        code: 'UNIQUE'
      });

      try {
        await RegionalPaymentMethod.create({
          name: 'Second Method',
          code: 'UNIQUE'
        });
        fail('Should have thrown duplicate key error');
      } catch (error) {
        expect(error.code).toBe(11000); // MongoDB duplicate key error
      }
    });

    test('should validate payment type enum', async () => {
      if (!global.isConnected()) return;

      try {
        await RegionalPaymentMethod.create({
          name: 'Invalid Type',
          code: 'INVALID',
          type: 'invalid_type'
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
      }
    });
  });

  describe('Payment Method Filtering', () => {
    beforeEach(async () => {
      if (!global.isConnected()) return;

      // Seed test data
      await RegionalPaymentMethod.create([
        {
          name: 'SEPA',
          code: 'SEPA_TEST',
          regions: ['EU'],
          countries: ['DE', 'FR', 'ES'],
          currencies: ['EUR'],
          type: 'bank_transfer',
          isActive: true
        },
        {
          name: 'iDEAL',
          code: 'IDEAL_TEST',
          regions: ['EU'],
          countries: ['NL'],
          currencies: ['EUR'],
          type: 'bank_transfer',
          isActive: true
        },
        {
          name: 'Alipay',
          code: 'ALIPAY_TEST',
          regions: ['APAC'],
          countries: ['CN'],
          currencies: ['CNY', 'USD'],
          type: 'digital_wallet',
          isActive: true
        }
      ]);
    });

    test('should find payment methods by region', async () => {
      if (!global.isConnected()) return;

      const euMethods = await RegionalPaymentMethod.find({
        regions: 'EU',
        isActive: true
      });

      expect(euMethods.length).toBeGreaterThanOrEqual(2);
      expect(euMethods.every(m => m.regions.includes('EU'))).toBe(true);
    });

    test('should find payment methods by country', async () => {
      if (!global.isConnected()) return;

      const nlMethods = await RegionalPaymentMethod.find({
        countries: 'NL',
        isActive: true
      });

      expect(nlMethods.length).toBeGreaterThanOrEqual(1);
      expect(nlMethods[0].code).toBe('IDEAL_TEST');
    });

    test('should find payment methods by currency', async () => {
      if (!global.isConnected()) return;

      const eurMethods = await RegionalPaymentMethod.find({
        currencies: 'EUR',
        isActive: true
      });

      expect(eurMethods.length).toBeGreaterThanOrEqual(2);
      expect(eurMethods.every(m => m.currencies.includes('EUR'))).toBe(true);
    });

    test('should find payment methods by type', async () => {
      if (!global.isConnected()) return;

      const bankMethods = await RegionalPaymentMethod.find({
        type: 'bank_transfer',
        isActive: true
      });

      expect(bankMethods.length).toBeGreaterThanOrEqual(2);
      
      const walletMethods = await RegionalPaymentMethod.find({
        type: 'digital_wallet',
        isActive: true
      });

      expect(walletMethods.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Payment Method Metadata', () => {
    test('should store fees', async () => {
      if (!global.isConnected()) return;

      const method = await RegionalPaymentMethod.create({
        name: 'PayPal Test',
        code: 'PAYPAL_TEST',
        fees: {
          fixed: 0.30,
          percentage: 2.9
        }
      });

      expect(method.fees.fixed).toBe(0.30);
      expect(method.fees.percentage).toBe(2.9);
    });

    test('should store custom metadata', async () => {
      if (!global.isConnected()) return;

      const method = await RegionalPaymentMethod.create({
        name: 'Custom Method',
        code: 'CUSTOM',
        metadata: {
          apiKey: 'test-key',
          webhookUrl: 'https://example.com/webhook',
          customField: 'custom-value'
        }
      });

      expect(method.metadata).toHaveProperty('apiKey', 'test-key');
      expect(method.metadata).toHaveProperty('webhookUrl');
      expect(method.metadata).toHaveProperty('customField');
    });

    test('should store processing time', async () => {
      if (!global.isConnected()) return;

      const method = await RegionalPaymentMethod.create({
        name: 'Instant Payment',
        code: 'INSTANT',
        processingTime: 'Instant'
      });

      expect(method.processingTime).toBe('Instant');
    });
  });

  describe('Payment Method Updates', () => {
    test('should update payment method', async () => {
      if (!global.isConnected()) return;

      const method = await RegionalPaymentMethod.create({
        name: 'Original Name',
        code: 'UPDATE_TEST',
        isActive: true
      });

      method.name = 'Updated Name';
      method.isActive = false;
      await method.save();

      const updated = await RegionalPaymentMethod.findById(method._id);
      expect(updated.name).toBe('Updated Name');
      expect(updated.isActive).toBe(false);
    });

    test('should add countries to existing method', async () => {
      if (!global.isConnected()) return;

      const method = await RegionalPaymentMethod.create({
        name: 'Expandable',
        code: 'EXPAND',
        countries: ['US']
      });

      method.countries.push('CA', 'MX');
      await method.save();

      const updated = await RegionalPaymentMethod.findById(method._id);
      expect(updated.countries).toContain('US');
      expect(updated.countries).toContain('CA');
      expect(updated.countries).toContain('MX');
    });
  });
});
