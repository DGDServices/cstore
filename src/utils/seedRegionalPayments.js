const RegionalPaymentMethod = require('../models/RegionalPaymentMethod');
const logger = require('./logger');

const regionalPaymentMethods = [
  // Europe
  {
    name: 'SEPA Bank Transfer',
    code: 'SEPA',
    description: 'Single Euro Payments Area bank transfer',
    regions: ['EU'],
    countries: ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'GR', 'IE'],
    currencies: ['EUR'],
    type: 'bank_transfer',
    processingTime: '1-3 business days',
    fees: { fixed: 0, percentage: 0 },
    provider: 'Bank'
  },
  {
    name: 'iDEAL',
    code: 'IDEAL',
    description: 'Dutch online banking payment method',
    regions: ['EU'],
    countries: ['NL'],
    currencies: ['EUR'],
    type: 'bank_transfer',
    processingTime: 'Instant',
    fees: { fixed: 0.29, percentage: 0 },
    provider: 'iDEAL'
  },
  {
    name: 'Bancontact',
    code: 'BANCONTACT',
    description: 'Belgian online banking payment method',
    regions: ['EU'],
    countries: ['BE'],
    currencies: ['EUR'],
    type: 'bank_transfer',
    processingTime: 'Instant',
    fees: { fixed: 0.29, percentage: 0 },
    provider: 'Bancontact'
  },
  {
    name: 'Sofort',
    code: 'SOFORT',
    description: 'European online banking payment',
    regions: ['EU'],
    countries: ['DE', 'AT', 'CH', 'NL', 'BE'],
    currencies: ['EUR', 'CHF'],
    type: 'bank_transfer',
    processingTime: 'Instant',
    fees: { fixed: 0.29, percentage: 1.4 },
    provider: 'Sofort'
  },
  
  // United Kingdom
  {
    name: 'Faster Payments',
    code: 'UK_FASTER',
    description: 'UK faster payment service',
    regions: ['UK'],
    countries: ['GB'],
    currencies: ['GBP'],
    type: 'bank_transfer',
    processingTime: 'Within 2 hours',
    fees: { fixed: 0, percentage: 0 },
    provider: 'Bank'
  },
  
  // North America
  {
    name: 'ACH Transfer',
    code: 'ACH',
    description: 'Automated Clearing House transfer',
    regions: ['NA'],
    countries: ['US'],
    currencies: ['USD'],
    type: 'bank_transfer',
    processingTime: '1-3 business days',
    fees: { fixed: 0, percentage: 0 },
    provider: 'Bank'
  },
  {
    name: 'Interac e-Transfer',
    code: 'INTERAC',
    description: 'Canadian electronic transfer',
    regions: ['NA'],
    countries: ['CA'],
    currencies: ['CAD'],
    type: 'bank_transfer',
    processingTime: '30 minutes',
    fees: { fixed: 1.5, percentage: 0 },
    provider: 'Interac'
  },
  
  // South America
  {
    name: 'PIX',
    code: 'PIX',
    description: 'Brazilian instant payment system',
    regions: ['SA'],
    countries: ['BR'],
    currencies: ['BRL'],
    type: 'bank_transfer',
    processingTime: 'Instant',
    fees: { fixed: 0, percentage: 0 },
    provider: 'Central Bank of Brazil'
  },
  
  // Asia-Pacific
  {
    name: 'Alipay',
    code: 'ALIPAY',
    description: 'Chinese digital wallet',
    regions: ['APAC'],
    countries: ['CN', 'HK', 'SG'],
    currencies: ['CNY', 'USD'],
    type: 'digital_wallet',
    processingTime: 'Instant',
    fees: { fixed: 0, percentage: 2.5 },
    provider: 'Alipay'
  },
  {
    name: 'WeChat Pay',
    code: 'WECHAT',
    description: 'Chinese mobile payment',
    regions: ['APAC'],
    countries: ['CN', 'HK'],
    currencies: ['CNY', 'USD'],
    type: 'digital_wallet',
    processingTime: 'Instant',
    fees: { fixed: 0, percentage: 2.5 },
    provider: 'WeChat'
  },
  {
    name: 'UPI',
    code: 'UPI',
    description: 'Unified Payments Interface (India)',
    regions: ['APAC'],
    countries: ['IN'],
    currencies: ['INR'],
    type: 'bank_transfer',
    processingTime: 'Instant',
    fees: { fixed: 0, percentage: 0 },
    provider: 'NPCI'
  },
  {
    name: 'GrabPay',
    code: 'GRABPAY',
    description: 'Southeast Asian digital wallet',
    regions: ['APAC'],
    countries: ['SG', 'MY', 'TH', 'ID', 'PH', 'VN'],
    currencies: ['SGD', 'MYR', 'THB', 'IDR', 'PHP', 'VND'],
    type: 'digital_wallet',
    processingTime: 'Instant',
    fees: { fixed: 0, percentage: 2 },
    provider: 'Grab'
  },
  
  // Global methods
  {
    name: 'PayPal',
    code: 'PAYPAL',
    description: 'Global digital payment platform',
    regions: ['GLOBAL'],
    countries: ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'AU', 'JP', 'CN', 'IN', 'BR'],
    currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    type: 'digital_wallet',
    processingTime: 'Instant',
    fees: { fixed: 0.30, percentage: 2.9 },
    provider: 'PayPal'
  },
  {
    name: 'Credit/Debit Card',
    code: 'CARD',
    description: 'Visa, Mastercard, American Express',
    regions: ['GLOBAL'],
    countries: [],
    currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL'],
    type: 'card',
    processingTime: 'Instant',
    fees: { fixed: 0.30, percentage: 2.9 },
    provider: 'Stripe'
  }
];

async function seedRegionalPayments() {
  try {
    logger.info('Seeding regional payment methods...');
    
    for (const method of regionalPaymentMethods) {
      await RegionalPaymentMethod.findOneAndUpdate(
        { code: method.code },
        method,
        { upsert: true, new: true }
      );
    }
    
    logger.info(`Seeded ${regionalPaymentMethods.length} regional payment methods`);
    return { success: true, count: regionalPaymentMethods.length };
  } catch (error) {
    logger.error(`Error seeding regional payment methods: ${error.message}`);
    throw error;
  }
}

module.exports = { seedRegionalPayments, regionalPaymentMethods };
