const lightningMonitoring = require('../src/services/lightningMonitoring');
const LightningInvoice = require('../src/models/LightningInvoice');
const LightningChannel = require('../src/models/LightningChannel');
const Payment = require('../src/models/Payment');

describe('Lightning Network Monitoring Service', () => {
  beforeAll(() => {
    if (!global.isConnected || !global.isConnected()) {
      console.log('Skipping Lightning Monitoring tests - database not available');
    }
  });

  beforeEach(() => {
    // Reset monitoring metrics before each test
    lightningMonitoring.reset();
  });

  describe('Payment Recording', () => {
    it('should record successful payment', () => {
      lightningMonitoring.recordPayment({
        status: 'paid',
        amount: 10000,
        amountUSD: 10.0,
        fee: 1
      });

      const metrics = lightningMonitoring.metrics;
      expect(metrics.payments.total).toBe(1);
      expect(metrics.payments.successful).toBe(1);
      expect(metrics.payments.totalVolume).toBe(10000);
      expect(metrics.payments.totalVolumeUSD).toBe(10.0);
    });

    it('should record failed payment', () => {
      lightningMonitoring.recordPayment({
        status: 'failed',
        amount: 5000,
        amountUSD: 5.0
      });

      const metrics = lightningMonitoring.metrics;
      expect(metrics.payments.total).toBe(1);
      expect(metrics.payments.failed).toBe(1);
      expect(metrics.payments.totalVolume).toBe(0);
    });

    it('should calculate success rate correctly', () => {
      lightningMonitoring.recordPayment({ status: 'paid', amount: 1000, amountUSD: 1 });
      lightningMonitoring.recordPayment({ status: 'paid', amount: 2000, amountUSD: 2 });
      lightningMonitoring.recordPayment({ status: 'failed', amount: 3000, amountUSD: 3 });

      const metrics = lightningMonitoring.metrics;
      expect(metrics.performance.successRate).toBeCloseTo(66.67, 1);
    });

    it('should record fees correctly', () => {
      lightningMonitoring.recordPayment({
        status: 'paid',
        amount: 10000,
        amountUSD: 10.0,
        fee: 10
      });

      lightningMonitoring.recordPayment({
        status: 'paid',
        amount: 20000,
        amountUSD: 20.0,
        fee: 20
      });

      const metrics = lightningMonitoring.metrics;
      expect(metrics.fees.totalPaid).toBe(30);
      expect(metrics.fees.average).toBe(15);
      expect(metrics.fees.count).toBe(2);
    });
  });

  describe('Payment Statistics', () => {
    it('should get payment stats from database', async () => {
      if (!global.isConnected()) return;

      // Clean up existing data
      await LightningInvoice.deleteMany({});

      // Create test invoices
      await new LightningInvoice({
        order: '507f1f77bcf86cd799439011',
        paymentRequest: 'lnbc1...',
        paymentHash: 'hash1',
        amount: 10000,
        amountMsat: 10000000,
        amountUSD: 10.0,
        description: 'Test 1',
        status: 'paid',
        expiresAt: new Date(Date.now() + 3600000),
        paidAt: new Date()
      }).save();

      await new LightningInvoice({
        order: '507f1f77bcf86cd799439012',
        paymentRequest: 'lnbc2...',
        paymentHash: 'hash2',
        amount: 20000,
        amountMsat: 20000000,
        amountUSD: 20.0,
        description: 'Test 2',
        status: 'expired',
        expiresAt: new Date(Date.now() - 1000)
      }).save();

      const stats = await lightningMonitoring.getPaymentStats();

      expect(stats.total).toBe(2);
      expect(stats.paid).toBe(1);
      expect(stats.expired).toBe(1);
      expect(stats.totalVolume).toBe(10000);
      expect(stats.totalVolumeUSD).toBe(10.0);
    });

    it('should filter stats by date range', async () => {
      if (!global.isConnected()) return;

      await LightningInvoice.deleteMany({});

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create old invoice
      const oldInvoice = new LightningInvoice({
        order: '507f1f77bcf86cd799439013',
        paymentRequest: 'lnbc3...',
        paymentHash: 'hash3',
        amount: 30000,
        amountMsat: 30000000,
        amountUSD: 30.0,
        description: 'Old',
        status: 'paid',
        expiresAt: tomorrow
      });
      oldInvoice.createdAt = yesterday;
      await oldInvoice.save();

      // Create recent invoice
      await new LightningInvoice({
        order: '507f1f77bcf86cd799439014',
        paymentRequest: 'lnbc4...',
        paymentHash: 'hash4',
        amount: 40000,
        amountMsat: 40000000,
        amountUSD: 40.0,
        description: 'Recent',
        status: 'paid',
        expiresAt: tomorrow
      }).save();

      const stats = await lightningMonitoring.getPaymentStats(new Date(), tomorrow);

      expect(stats.total).toBe(1);
      expect(stats.totalVolume).toBe(40000);
    });
  });

  describe('Channel Statistics', () => {
    it('should get channel stats from database', async () => {
      if (!global.isConnected()) return;

      await LightningChannel.deleteMany({});

      await new LightningChannel({
        channelId: 'chan1',
        remotePubkey: '03abc...',
        capacity: 1000000,
        localBalance: 600000,
        remoteBalance: 400000,
        status: 'active',
        isActive: true
      }).save();

      await new LightningChannel({
        channelId: 'chan2',
        remotePubkey: '03def...',
        capacity: 2000000,
        localBalance: 1000000,
        remoteBalance: 1000000,
        status: 'active',
        isActive: true
      }).save();

      const stats = await lightningMonitoring.getChannelStats();

      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
      expect(stats.totalCapacity).toBe(3000000);
      expect(stats.totalLocalBalance).toBe(1600000);
      expect(stats.totalRemoteBalance).toBe(1400000);
    });

    it('should calculate channel utilization', async () => {
      if (!global.isConnected()) return;

      await LightningChannel.deleteMany({});

      await new LightningChannel({
        channelId: 'chan3',
        remotePubkey: '03ghi...',
        capacity: 1000000,
        localBalance: 800000,
        remoteBalance: 200000,
        status: 'active',
        isActive: true
      }).save();

      const stats = await lightningMonitoring.getChannelStats();

      expect(parseFloat(stats.channelUtilization)).toBeCloseTo(100, 0);
    });
  });

  describe('Fee Analysis', () => {
    it('should analyze Lightning Network fees', async () => {
      if (!global.isConnected()) return;

      await Payment.deleteMany({ cryptocurrency: 'BTC-LN' });

      // Create Lightning payments
      await new Payment({
        order: '507f1f77bcf86cd799439015',
        transactionHash: 'ln-hash1',
        cryptocurrency: 'BTC-LN',
        amount: 0.0001,
        amountUSD: 10.0,
        fromAddress: 'Lightning Network',
        toAddress: 'Lightning Network',
        status: 'confirmed',
        confirmations: 1,
        confirmedAt: new Date()
      }).save();

      const analysis = await lightningMonitoring.getFeeAnalysis();

      expect(analysis.totalPayments).toBe(1);
      expect(analysis.avgFeeSats).toBeLessThan(1);
    });
  });

  describe('Dashboard Metrics', () => {
    it('should generate comprehensive dashboard metrics', async () => {
      if (!global.isConnected()) return;

      const metrics = await lightningMonitoring.getDashboardMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('payments');
      expect(metrics).toHaveProperty('channels');
      expect(metrics).toHaveProperty('fees');
      expect(metrics).toHaveProperty('recentTransactions');
      expect(metrics).toHaveProperty('uptime');
    });
  });

  describe('Channel Performance', () => {
    it('should analyze channel performance', async () => {
      if (!global.isConnected()) return;

      await LightningChannel.deleteMany({});

      // Create balanced channel
      await new LightningChannel({
        channelId: 'balanced',
        remotePubkey: '03balanced...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'active',
        isActive: true
      }).save();

      // Create unbalanced channel
      await new LightningChannel({
        channelId: 'unbalanced',
        remotePubkey: '03unbalanced...',
        capacity: 1000000,
        localBalance: 900000,
        remoteBalance: 100000,
        status: 'active',
        isActive: true
      }).save();

      const performance = await lightningMonitoring.getChannelPerformance();

      expect(performance.channels).toHaveLength(2);
      expect(performance.summary.total).toBe(2);
      expect(performance.summary.needsRebalancing).toBeGreaterThan(0);
    });
  });

  describe('Analytics Reports', () => {
    it('should generate analytics report for 30 days', async () => {
      if (!global.isConnected()) return;

      const report = await lightningMonitoring.generateReport({ period: '30d' });

      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('startDate');
      expect(report).toHaveProperty('endDate');
      expect(report).toHaveProperty('payments');
      expect(report).toHaveProperty('channels');
      expect(report).toHaveProperty('fees');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('generatedAt');
    });

    it('should support different time periods', async () => {
      if (!global.isConnected()) return;

      const periods = ['24h', '7d', '30d', '90d'];

      for (const period of periods) {
        const report = await lightningMonitoring.generateReport({ period });
        expect(report.period).toBe(period);
      }
    });
  });

  describe('Transaction History', () => {
    it('should get transaction history with pagination', async () => {
      if (!global.isConnected()) return;

      await LightningInvoice.deleteMany({});

      // Create multiple invoices
      for (let i = 0; i < 15; i++) {
        await new LightningInvoice({
          order: '507f1f77bcf86cd799439011',
          paymentRequest: `lnbc${i}...`,
          paymentHash: `hash${i}`,
          amount: 1000 * (i + 1),
          amountMsat: 1000000 * (i + 1),
          amountUSD: (i + 1),
          description: `Test ${i}`,
          status: i % 2 === 0 ? 'paid' : 'pending',
          expiresAt: new Date(Date.now() + 3600000)
        }).save();
      }

      const history = await lightningMonitoring.getTransactionHistory({}, { limit: 10 });

      expect(history.invoices).toHaveLength(10);
      expect(history.total).toBe(15);
      expect(history.hasMore).toBe(true);
    });

    it('should filter transaction history by status', async () => {
      if (!global.isConnected()) return;

      const history = await lightningMonitoring.getTransactionHistory(
        { status: 'paid' },
        { limit: 20 }
      );

      history.invoices.forEach(invoice => {
        expect(invoice.status).toBe('paid');
      });
    });
  });
});
