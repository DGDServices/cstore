const LightningInvoice = require('../src/models/LightningInvoice');
const LightningChannel = require('../src/models/LightningChannel');
const lightningService = require('../src/services/lightningService');
const Order = require('../src/models/Order');

describe('Lightning Network Integration', () => {
  // Skip tests if database not available
  beforeAll(() => {
    if (!global.isConnected || !global.isConnected()) {
      console.log('Skipping Lightning Network tests - database not available');
    }
  });

  describe('LightningInvoice Model', () => {
    it('should create a Lightning invoice', async () => {
      if (!global.isConnected()) return;

      const invoiceData = {
        order: '507f1f77bcf86cd799439011',
        paymentRequest: 'lnbc10u1p3test...',
        paymentHash: 'abc123def456',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.50,
        description: 'Test order',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000)
      };

      const invoice = new LightningInvoice(invoiceData);
      await invoice.save();

      expect(invoice._id).toBeDefined();
      expect(invoice.paymentHash).toBe('abc123def456');
      expect(invoice.amount).toBe(1000);
      expect(invoice.status).toBe('pending');
    });

    it('should enforce unique payment hash', async () => {
      if (!global.isConnected()) return;

      const invoiceData = {
        order: '507f1f77bcf86cd799439011',
        paymentRequest: 'lnbc10u1p3test1...',
        paymentHash: 'unique123',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.50,
        description: 'Test order',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000)
      };

      await new LightningInvoice(invoiceData).save();

      // Try to create another invoice with same payment hash
      const duplicateInvoice = new LightningInvoice(invoiceData);
      await expect(duplicateInvoice.save()).rejects.toThrow();
    });

    it('should check invoice expiration', async () => {
      if (!global.isConnected()) return;

      const expiredInvoice = new LightningInvoice({
        order: '507f1f77bcf86cd799439011',
        paymentRequest: 'lnbc10u1p3expired...',
        paymentHash: 'expired123',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.50,
        description: 'Expired invoice',
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000) // Already expired
      });

      const isExpired = expiredInvoice.checkExpiration();
      expect(isExpired).toBe(true);
      expect(expiredInvoice.status).toBe('expired');
    });

    it('should not mark non-expired invoice as expired', async () => {
      if (!global.isConnected()) return;

      const activeInvoice = new LightningInvoice({
        order: '507f1f77bcf86cd799439011',
        paymentRequest: 'lnbc10u1p3active...',
        paymentHash: 'active123',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.50,
        description: 'Active invoice',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000) // Valid for 1 hour
      });

      const isExpired = activeInvoice.checkExpiration();
      expect(isExpired).toBe(false);
      expect(activeInvoice.status).toBe('pending');
    });

    it('should require all mandatory fields', async () => {
      if (!global.isConnected()) return;

      const incompleteInvoice = new LightningInvoice({
        paymentRequest: 'lnbc10u1p3test...'
        // Missing required fields
      });

      await expect(incompleteInvoice.save()).rejects.toThrow();
    });
  });

  describe('LightningChannel Model', () => {
    it('should create a Lightning channel', async () => {
      if (!global.isConnected()) return;

      const channelData = {
        channelId: '12345678901234567890',
        remotePubkey: '03abc123def456...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'active',
        isActive: true,
        isPrivate: false
      };

      const channel = new LightningChannel(channelData);
      await channel.save();

      expect(channel._id).toBeDefined();
      expect(channel.channelId).toBe('12345678901234567890');
      expect(channel.capacity).toBe(1000000);
      expect(channel.isActive).toBe(true);
    });

    it('should enforce unique channel ID', async () => {
      if (!global.isConnected()) return;

      const channelData = {
        channelId: 'unique-channel-123',
        remotePubkey: '03abc123def456...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'active',
        isActive: true
      };

      await new LightningChannel(channelData).save();

      // Try to create another channel with same ID
      const duplicateChannel = new LightningChannel(channelData);
      await expect(duplicateChannel.save()).rejects.toThrow();
    });

    it('should update channel balances', async () => {
      if (!global.isConnected()) return;

      const channel = new LightningChannel({
        channelId: 'update-test-123',
        remotePubkey: '03abc123def456...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'active',
        isActive: true
      });

      await channel.save();

      channel.updateBalances(600000, 400000);
      expect(channel.localBalance).toBe(600000);
      expect(channel.remoteBalance).toBe(400000);
      expect(channel.lastUpdatedAt).toBeDefined();
    });

    it('should calculate available balance', async () => {
      if (!global.isConnected()) return;

      const channel = new LightningChannel({
        channelId: 'balance-test-123',
        remotePubkey: '03abc123def456...',
        capacity: 1000000,
        localBalance: 600000,
        remoteBalance: 400000,
        unsettledBalance: 50000,
        status: 'active',
        isActive: true
      });

      const availableBalance = channel.availableBalance;
      expect(availableBalance).toBe(550000); // 600000 - 50000
    });

    it('should validate channel status', async () => {
      if (!global.isConnected()) return;

      const channel = new LightningChannel({
        channelId: 'status-test-123',
        remotePubkey: '03abc123def456...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'invalid-status', // Invalid status
        isActive: true
      });

      await expect(channel.save()).rejects.toThrow();
    });
  });

  describe('Lightning Service', () => {
    it('should check if LND is available', () => {
      const available = lightningService.isLndAvailable();
      expect(typeof available).toBe('boolean');
      
      // LND should not be available in test environment
      expect(available).toBe(false);
    });

    it('should throw error when LND not available', async () => {
      await expect(
        lightningService.getWalletInfo()
      ).rejects.toThrow('Lightning Network not available');
    });

    it('should throw error when creating invoice without LND', async () => {
      await expect(
        lightningService.createInvoice({
          amount: 1000,
          description: 'Test invoice',
          orderId: '507f1f77bcf86cd799439011',
          amountUSD: 10.50
        })
      ).rejects.toThrow('Lightning Network not available');
    });

    it('should throw error when getting balance without LND', async () => {
      await expect(
        lightningService.getBalance()
      ).rejects.toThrow('Lightning Network not available');
    });

    it('should throw error when listing channels without LND', async () => {
      await expect(
        lightningService.listChannels()
      ).rejects.toThrow('Lightning Network not available');
    });

    it('should throw error when opening channel without LND', async () => {
      await expect(
        lightningService.openChannel({
          publicKey: '03abc123...',
          localAmount: 1000000
        })
      ).rejects.toThrow('Lightning Network not available');
    });

    it('should throw error when closing channel without LND', async () => {
      await expect(
        lightningService.closeChannel('channel-id-123')
      ).rejects.toThrow('Lightning Network not available');
    });

    it('should throw error when paying invoice without LND', async () => {
      await expect(
        lightningService.payInvoice('lnbc10u1p3...')
      ).rejects.toThrow('Lightning Network not available');
    });

    it('should throw error when decoding payment request without LND', async () => {
      await expect(
        lightningService.decodePaymentRequest('lnbc10u1p3...')
      ).rejects.toThrow('Lightning Network not available');
    });
  });

  describe('Lightning Invoice Database Operations', () => {
    it('should find invoice by payment hash', async () => {
      if (!global.isConnected()) return;

      const invoice = new LightningInvoice({
        order: '507f1f77bcf86cd799439011',
        paymentRequest: 'lnbc10u1p3find...',
        paymentHash: 'findme123',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.50,
        description: 'Find test',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000)
      });

      await invoice.save();

      const foundInvoice = await LightningInvoice.findOne({ 
        paymentHash: 'findme123' 
      });

      expect(foundInvoice).toBeDefined();
      expect(foundInvoice.paymentHash).toBe('findme123');
    });

    it('should find invoices by order', async () => {
      if (!global.isConnected()) return;

      const orderId = '507f1f77bcf86cd799439012';

      await new LightningInvoice({
        order: orderId,
        paymentRequest: 'lnbc10u1p3order1...',
        paymentHash: 'order-hash-1',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.50,
        description: 'Order test 1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000)
      }).save();

      await new LightningInvoice({
        order: orderId,
        paymentRequest: 'lnbc10u1p3order2...',
        paymentHash: 'order-hash-2',
        amount: 2000,
        amountMsat: 2000000,
        amountUSD: 20.50,
        description: 'Order test 2',
        status: 'expired',
        expiresAt: new Date(Date.now() - 1000)
      }).save();

      const invoices = await LightningInvoice.find({ order: orderId });
      expect(invoices).toHaveLength(2);
    });

    it('should find pending invoices', async () => {
      if (!global.isConnected()) return;

      await LightningInvoice.deleteMany({});

      await new LightningInvoice({
        order: '507f1f77bcf86cd799439013',
        paymentRequest: 'lnbc10u1p3pending1...',
        paymentHash: 'pending-1',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.50,
        description: 'Pending 1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000)
      }).save();

      await new LightningInvoice({
        order: '507f1f77bcf86cd799439014',
        paymentRequest: 'lnbc10u1p3paid...',
        paymentHash: 'paid-1',
        amount: 2000,
        amountMsat: 2000000,
        amountUSD: 20.50,
        description: 'Paid 1',
        status: 'paid',
        expiresAt: new Date(Date.now() + 3600000),
        paidAt: new Date()
      }).save();

      const pendingInvoices = await LightningInvoice.find({ status: 'pending' });
      expect(pendingInvoices.length).toBeGreaterThan(0);
      expect(pendingInvoices.every(inv => inv.status === 'pending')).toBe(true);
    });

    it('should update invoice status to paid', async () => {
      if (!global.isConnected()) return;

      const invoice = new LightningInvoice({
        order: '507f1f77bcf86cd799439015',
        paymentRequest: 'lnbc10u1p3update...',
        paymentHash: 'update-status-123',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.50,
        description: 'Status update test',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000)
      });

      await invoice.save();

      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.preimage = 'preimage123';
      await invoice.save();

      const updatedInvoice = await LightningInvoice.findOne({ 
        paymentHash: 'update-status-123' 
      });

      expect(updatedInvoice.status).toBe('paid');
      expect(updatedInvoice.paidAt).toBeDefined();
      expect(updatedInvoice.preimage).toBe('preimage123');
    });
  });

  describe('Lightning Channel Database Operations', () => {
    it('should find channel by channel ID', async () => {
      if (!global.isConnected()) return;

      const channel = new LightningChannel({
        channelId: 'find-channel-123',
        remotePubkey: '03abc123def456...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'active',
        isActive: true
      });

      await channel.save();

      const foundChannel = await LightningChannel.findOne({ 
        channelId: 'find-channel-123' 
      });

      expect(foundChannel).toBeDefined();
      expect(foundChannel.channelId).toBe('find-channel-123');
    });

    it('should find active channels', async () => {
      if (!global.isConnected()) return;

      await LightningChannel.deleteMany({});

      await new LightningChannel({
        channelId: 'active-1',
        remotePubkey: '03abc1...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'active',
        isActive: true
      }).save();

      await new LightningChannel({
        channelId: 'inactive-1',
        remotePubkey: '03abc2...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'inactive',
        isActive: false
      }).save();

      const activeChannels = await LightningChannel.find({ isActive: true });
      expect(activeChannels).toHaveLength(1);
      expect(activeChannels[0].channelId).toBe('active-1');
    });

    it('should update channel status', async () => {
      if (!global.isConnected()) return;

      const channel = new LightningChannel({
        channelId: 'status-update-123',
        remotePubkey: '03abc123def456...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'pending',
        isActive: false
      });

      await channel.save();

      channel.status = 'active';
      channel.isActive = true;
      await channel.save();

      const updatedChannel = await LightningChannel.findOne({ 
        channelId: 'status-update-123' 
      });

      expect(updatedChannel.status).toBe('active');
      expect(updatedChannel.isActive).toBe(true);
    });
  });

  describe('Lightning Integration Workflow', () => {
    it('should validate invoice expiration check', async () => {
      if (!global.isConnected()) return;

      const invoice = new LightningInvoice({
        order: '507f1f77bcf86cd799439099',
        paymentRequest: 'lnbc10u1p3workflow1...',
        paymentHash: 'workflow-test-1',
        amount: 5000,
        amountMsat: 5000000,
        amountUSD: 50.00,
        description: 'Workflow test invoice',
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000) // Already expired
      });

      const isExpired = invoice.checkExpiration();
      expect(isExpired).toBe(true);
      expect(invoice.status).toBe('expired');
    });

    it('should handle multiple invoices for same order', async () => {
      if (!global.isConnected()) return;

      const orderId = '507f1f77bcf86cd799439088';

      // Create first invoice (expired)
      const invoice1 = await new LightningInvoice({
        order: orderId,
        paymentRequest: 'lnbc10u1p3multi1...',
        paymentHash: 'multi-hash-1',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.00,
        description: 'First invoice',
        status: 'expired',
        expiresAt: new Date(Date.now() - 1000)
      }).save();

      // Create second invoice (pending)
      const invoice2 = await new LightningInvoice({
        order: orderId,
        paymentRequest: 'lnbc10u1p3multi2...',
        paymentHash: 'multi-hash-2',
        amount: 1000,
        amountMsat: 1000000,
        amountUSD: 10.00,
        description: 'Second invoice',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000)
      }).save();

      const invoices = await LightningInvoice.find({ order: orderId });
      expect(invoices).toHaveLength(2);
      
      const pendingInvoices = await LightningInvoice.find({ 
        order: orderId, 
        status: 'pending' 
      });
      expect(pendingInvoices).toHaveLength(1);
      expect(pendingInvoices[0].paymentHash).toBe('multi-hash-2');
    });

    it('should calculate correct millisatoshi values', async () => {
      if (!global.isConnected()) return;

      const satoshis = 10000;
      const millisatoshis = satoshis * 1000;

      const invoice = new LightningInvoice({
        order: '507f1f77bcf86cd799439077',
        paymentRequest: 'lnbc100u1p3calc...',
        paymentHash: 'calc-test-1',
        amount: satoshis,
        amountMsat: millisatoshis,
        amountUSD: 100.00,
        description: 'Calculation test',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000)
      });

      await invoice.save();

      expect(invoice.amount).toBe(10000);
      expect(invoice.amountMsat).toBe(10000000);
      expect(invoice.amountMsat).toBe(invoice.amount * 1000);
    });

    it('should properly track channel balance changes', async () => {
      if (!global.isConnected()) return;

      const channel = new LightningChannel({
        channelId: 'balance-track-123',
        remotePubkey: '03balance...',
        capacity: 1000000,
        localBalance: 800000,
        remoteBalance: 200000,
        status: 'active',
        isActive: true
      });

      await channel.save();

      // Simulate a payment (local balance decreases, remote increases)
      channel.updateBalances(750000, 250000);
      await channel.save();

      expect(channel.localBalance).toBe(750000);
      expect(channel.remoteBalance).toBe(250000);
      expect(channel.localBalance + channel.remoteBalance).toBe(channel.capacity);
      expect(channel.lastUpdatedAt).toBeDefined();
    });

    it('should validate channel capacity constraints', async () => {
      if (!global.isConnected()) return;

      const channel = new LightningChannel({
        channelId: 'capacity-test-123',
        remotePubkey: '03capacity...',
        capacity: 1000000,
        localBalance: 600000,
        remoteBalance: 400000,
        unsettledBalance: 50000,
        status: 'active',
        isActive: true
      });

      const availableBalance = channel.availableBalance;
      expect(availableBalance).toBe(550000); // 600000 - 50000
      expect(availableBalance + channel.unsettledBalance).toBe(channel.localBalance);
    });
  });
});
