const mongoose = require('mongoose');
const Escrow = require('../src/models/Escrow');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const escrowService = require('../src/services/escrowService');

describe('Escrow System', () => {
  let buyer, seller, admin;
  
  beforeEach(async () => {
    if (!global.isConnected()) {
      return;
    }
    
    // Create test users
    buyer = await User.create({
      name: 'Buyer Test',
      email: 'buyer@test.com',
      password: 'password123',
      role: 'user'
    });
    
    seller = await User.create({
      name: 'Seller Test',
      email: 'seller@test.com',
      password: 'password123',
      role: 'user'
    });
    
    admin = await User.create({
      name: 'Admin Test',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });
  });
  
  describe('Escrow Model', () => {
    test('should create a basic escrow contract', async () => {
      if (!global.isConnected()) return;
      
      const escrowData = {
        buyer: buyer._id,
        seller: seller._id,
        title: 'Test Product Escrow',
        description: 'Escrow for test product purchase',
        amount: 0.5,
        cryptocurrency: 'BTC',
        amountUSD: 25000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseAddress: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        refundAddress: '1C1mCxRukix1KfegAY5zQQJV7samAciZpv',
        releaseType: 'manual'
      };
      
      const escrow = await Escrow.create(escrowData);
      
      expect(escrow).toBeDefined();
      expect(escrow.status).toBe('created');
      expect(escrow.buyer.toString()).toBe(buyer._id.toString());
      expect(escrow.seller.toString()).toBe(seller._id.toString());
      expect(escrow.amount).toBe(0.5);
      expect(escrow.cryptocurrency).toBe('BTC');
    });
    
    test('should create milestone-based escrow', async () => {
      if (!global.isConnected()) return;
      
      const escrowData = {
        buyer: buyer._id,
        seller: seller._id,
        title: 'Project Milestone Escrow',
        amount: 1.0,
        cryptocurrency: 'ETH',
        amountUSD: 3000,
        depositAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        releaseType: 'milestone_based',
        milestones: [
          { title: 'Design Phase', amount: 0.3 },
          { title: 'Development Phase', amount: 0.5 },
          { title: 'Testing Phase', amount: 0.2 }
        ]
      };
      
      const escrow = await Escrow.create(escrowData);
      
      expect(escrow.milestones).toHaveLength(3);
      expect(escrow.totalMilestoneAmount).toBe(1.0);
    });
    
    test('should validate milestone amounts match escrow amount', async () => {
      if (!global.isConnected()) return;
      
      const escrowData = {
        buyer: buyer._id,
        seller: seller._id,
        title: 'Invalid Milestone Escrow',
        amount: 1.0,
        cryptocurrency: 'BTC',
        amountUSD: 50000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'milestone_based',
        milestones: [
          { title: 'Phase 1', amount: 0.3 },
          { title: 'Phase 2', amount: 0.4 }
        ]
      };
      
      await expect(Escrow.create(escrowData)).rejects.toThrow();
    });
    
    test('should check if user is a party', async () => {
      if (!global.isConnected()) return;
      
      const escrow = await Escrow.create({
        buyer: buyer._id,
        seller: seller._id,
        title: 'Test Escrow',
        amount: 0.1,
        cryptocurrency: 'BTC',
        amountUSD: 5000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'manual'
      });
      
      expect(escrow.isParty(buyer._id)).toBe(true);
      expect(escrow.isParty(seller._id)).toBe(true);
      expect(escrow.isParty(admin._id)).toBe(false);
    });
    
    test('should check action permissions', async () => {
      if (!global.isConnected()) return;
      
      const escrow = await Escrow.create({
        buyer: buyer._id,
        seller: seller._id,
        title: 'Test Escrow',
        amount: 0.1,
        cryptocurrency: 'BTC',
        amountUSD: 5000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'manual',
        status: 'funded'
      });
      
      expect(escrow.canPerformAction(buyer._id, 'release')).toBe(true);
      expect(escrow.canPerformAction(seller._id, 'release')).toBe(false);
      expect(escrow.canPerformAction(buyer._id, 'refund')).toBe(true);
      expect(escrow.canPerformAction(seller._id, 'refund')).toBe(true);
    });
  });
  
  describe('Escrow Service', () => {
    test('should create escrow with automatic fee calculation', async () => {
      if (!global.isConnected()) return;
      
      const escrowData = {
        buyer: buyer._id,
        seller: seller._id,
        title: 'Service Purchase',
        amount: 1.0,
        cryptocurrency: 'ETH',
        amountUSD: 3000,
        depositAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        releaseType: 'manual'
      };
      
      const escrow = await escrowService.createEscrow(escrowData, buyer._id);
      
      expect(escrow.fees).toBeDefined();
      expect(escrow.fees.length).toBeGreaterThan(0);
      expect(escrow.totalFees).toBeGreaterThan(0);
    });
    
    test('should enable multi-sig for high-value transactions', async () => {
      if (!global.isConnected()) return;
      
      const escrowData = {
        buyer: buyer._id,
        seller: seller._id,
        title: 'High Value Purchase',
        amount: 10,
        cryptocurrency: 'BTC',
        amountUSD: 500000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'manual'
      };
      
      const escrow = await escrowService.createEscrow(escrowData, buyer._id);
      
      expect(escrow.requiresMultiSig).toBe(true);
      expect(escrow.requiredApprovals).toBeGreaterThan(1);
    });
    
    test('should add escrow to history on creation', async () => {
      if (!global.isConnected()) return;
      
      const escrowData = {
        buyer: buyer._id,
        seller: seller._id,
        title: 'History Test',
        amount: 0.5,
        cryptocurrency: 'BTC',
        amountUSD: 25000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'manual'
      };
      
      const escrow = await escrowService.createEscrow(escrowData, buyer._id);
      
      expect(escrow.history).toBeDefined();
      expect(escrow.history.length).toBeGreaterThan(0);
      expect(escrow.history[0].action).toBe('created');
    });
    
    test('should file a dispute', async () => {
      if (!global.isConnected()) return;
      
      const escrow = await escrowService.createEscrow({
        buyer: buyer._id,
        seller: seller._id,
        title: 'Dispute Test',
        amount: 0.5,
        cryptocurrency: 'BTC',
        amountUSD: 25000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'manual'
      }, buyer._id);
      
      // Update status to funded
      escrow.status = 'funded';
      await escrow.save();
      
      const disputeData = {
        reason: 'Product not as described',
        description: 'The product received does not match the description provided by the seller.'
      };
      
      const disputedEscrow = await escrowService.fileDispute(
        escrow._id,
        buyer._id,
        disputeData
      );
      
      expect(disputedEscrow.status).toBe('disputed');
      expect(disputedEscrow.disputes.length).toBe(1);
      expect(disputedEscrow.disputes[0].reason).toBe(disputeData.reason);
    });
    
    test('should not allow duplicate disputes', async () => {
      if (!global.isConnected()) return;
      
      const escrow = await escrowService.createEscrow({
        buyer: buyer._id,
        seller: seller._id,
        title: 'Duplicate Dispute Test',
        amount: 0.5,
        cryptocurrency: 'BTC',
        amountUSD: 25000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'manual'
      }, buyer._id);
      
      escrow.status = 'funded';
      await escrow.save();
      
      const disputeData = {
        reason: 'Issue 1',
        description: 'First dispute about the transaction'
      };
      
      await escrowService.fileDispute(escrow._id, buyer._id, disputeData);
      
      await expect(
        escrowService.fileDispute(escrow._id, buyer._id, disputeData)
      ).rejects.toThrow('An active dispute already exists');
    });
    
    test('should complete milestone', async () => {
      if (!global.isConnected()) return;
      
      const escrow = await escrowService.createEscrow({
        buyer: buyer._id,
        seller: seller._id,
        title: 'Milestone Test',
        amount: 1.0,
        cryptocurrency: 'ETH',
        amountUSD: 3000,
        depositAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        releaseType: 'milestone_based',
        milestones: [
          { title: 'Phase 1', amount: 0.5 },
          { title: 'Phase 2', amount: 0.5 }
        ]
      }, buyer._id);
      
      escrow.status = 'funded';
      await escrow.save();
      
      const milestoneId = escrow.milestones[0]._id;
      const updatedEscrow = await escrowService.completeMilestone(
        escrow._id,
        milestoneId,
        seller._id
      );
      
      const milestone = updatedEscrow.milestones.id(milestoneId);
      expect(milestone.status).toBe('completed');
      expect(milestone.completedAt).toBeDefined();
    });
    
    test('should cancel unfunded escrow', async () => {
      if (!global.isConnected()) return;
      
      const escrow = await escrowService.createEscrow({
        buyer: buyer._id,
        seller: seller._id,
        title: 'Cancel Test',
        amount: 0.5,
        cryptocurrency: 'BTC',
        amountUSD: 25000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'manual'
      }, buyer._id);
      
      const cancelledEscrow = await escrowService.cancelEscrow(
        escrow._id,
        buyer._id,
        'Changed my mind'
      );
      
      expect(cancelledEscrow.status).toBe('cancelled');
    });
    
    test('should not cancel funded escrow', async () => {
      if (!global.isConnected()) return;
      
      const escrow = await escrowService.createEscrow({
        buyer: buyer._id,
        seller: seller._id,
        title: 'Funded Cancel Test',
        amount: 0.5,
        cryptocurrency: 'BTC',
        amountUSD: 25000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'manual'
      }, buyer._id);
      
      escrow.status = 'funded';
      await escrow.save();
      
      await expect(
        escrowService.cancelEscrow(escrow._id, buyer._id, 'Test')
      ).rejects.toThrow('Can only cancel unfunded escrows');
    });
    
    test('should calculate fees correctly', async () => {
      if (!global.isConnected()) return;
      
      const fees = escrowService.calculateFees(1.0, 'BTC');
      
      expect(fees).toBeDefined();
      expect(fees.length).toBeGreaterThan(0);
      
      const platformFee = fees.find(f => f.type === 'platform');
      const blockchainFee = fees.find(f => f.type === 'blockchain');
      
      expect(platformFee).toBeDefined();
      expect(platformFee.percentage).toBe(2);
      expect(blockchainFee).toBeDefined();
    });
  });
  
  describe('Release Conditions', () => {
    test('should check time-based conditions', async () => {
      if (!global.isConnected()) return;
      
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const escrow = await escrowService.createEscrow({
        buyer: buyer._id,
        seller: seller._id,
        title: 'Time Condition Test',
        amount: 0.5,
        cryptocurrency: 'BTC',
        amountUSD: 25000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'automatic',
        releaseConditions: [
          {
            type: 'time_based',
            value: pastDate
          }
        ]
      }, buyer._id);
      
      escrow.status = 'funded';
      escrow.fundedAt = new Date();
      await escrow.save();
      
      const updatedEscrow = await escrowService.checkReleaseConditions(escrow._id);
      
      expect(updatedEscrow.releaseConditions[0].met).toBe(true);
    });
  });
  
  describe('Multi-Signature Support', () => {
    test('should track multi-sig approvals', async () => {
      if (!global.isConnected()) return;
      
      const escrow = await Escrow.create({
        buyer: buyer._id,
        seller: seller._id,
        title: 'Multi-Sig Test',
        amount: 10,
        cryptocurrency: 'BTC',
        amountUSD: 500000,
        depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        releaseType: 'manual',
        requiresMultiSig: true,
        requiredApprovals: 2,
        status: 'funded'
      });
      
      escrow.multiSigApprovals.push({
        user: buyer._id,
        action: 'release',
        approved: true,
        approvedAt: new Date()
      });
      
      await escrow.save();
      
      expect(escrow.hasRequiredApprovals('release')).toBe(false);
      
      escrow.multiSigApprovals.push({
        user: admin._id,
        action: 'release',
        approved: true,
        approvedAt: new Date()
      });
      
      await escrow.save();
      
      expect(escrow.hasRequiredApprovals('release')).toBe(true);
    });
  });
});
