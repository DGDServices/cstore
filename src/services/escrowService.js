const Escrow = require('../models/Escrow');
const logger = require('../utils/logger');
const { verifyTransaction } = require('./blockchainService');

/**
 * Escrow Service
 * Handles core escrow business logic
 */
class EscrowService {
  /**
   * Create a new escrow contract
   */
  async createEscrow(escrowData, initiatedBy) {
    try {
      // Validate parties
      if (escrowData.buyer.toString() === escrowData.seller.toString()) {
        throw new Error('Buyer and seller cannot be the same user');
      }
      
      // Set default values
      escrowData.metadata = escrowData.metadata || {};
      escrowData.metadata.initiatedBy = initiatedBy;
      
      // Set expiration date if not provided
      if (!escrowData.expiresAt && escrowData.metadata.autoReleaseAfterDays) {
        escrowData.expiresAt = new Date(
          Date.now() + escrowData.metadata.autoReleaseAfterDays * 24 * 60 * 60 * 1000
        );
      }
      
      // Calculate fees
      const fees = this.calculateFees(escrowData.amount, escrowData.cryptocurrency);
      escrowData.fees = fees;
      escrowData.totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
      
      // Determine if multi-sig is required for high-value transactions
      if (escrowData.amountUSD >= 10000 && !escrowData.requiresMultiSig) {
        escrowData.requiresMultiSig = true;
        escrowData.requiredApprovals = 2;
      }
      
      // Create escrow
      const escrow = await Escrow.create(escrowData);
      
      // Add to history
      escrow.addHistory('created', initiatedBy, 'Escrow contract created');
      await escrow.save();
      
      // Log creation
      logger.info('Escrow created', {
        escrowId: escrow._id,
        buyer: escrow.buyer,
        seller: escrow.seller,
        amount: escrow.amount,
        cryptocurrency: escrow.cryptocurrency,
        initiatedBy
      });
      
      return escrow;
    } catch (error) {
      logger.error('Error creating escrow:', error);
      throw error;
    }
  }
  
  /**
   * Fund an escrow with cryptocurrency
   */
  async fundEscrow(escrowId, transactionHash, fundedBy) {
    try {
      const escrow = await Escrow.findById(escrowId);
      if (!escrow) {
        throw new Error('Escrow not found');
      }
      
      if (escrow.status !== 'created') {
        throw new Error(`Cannot fund escrow with status: ${escrow.status}`);
      }
      
      // Verify the transaction when blockchain verification is enabled
      let verification = { verified: true };
      if (process.env.VERIFY_BLOCKCHAIN === 'true') {
        verification = await verifyTransaction(
          escrow.cryptocurrency,
          transactionHash,
          escrow.depositAddress,
          escrow.amount
        );
      }
      
      if (!verification.verified) {
        throw new Error(verification.error || 'Transaction verification failed');
      }
      
      // Update escrow status
      escrow.depositTransactionHash = transactionHash;
      escrow.status = 'funded';
      escrow.fundedAt = new Date();
      escrow.addHistory('funded', fundedBy, `Escrow funded with transaction ${transactionHash}`);
      
      // Start auto-release timer if configured
      if (escrow.metadata.autoReleaseAfterDays && !escrow.expiresAt) {
        escrow.expiresAt = new Date(
          Date.now() + escrow.metadata.autoReleaseAfterDays * 24 * 60 * 60 * 1000
        );
      }
      
      await escrow.save();
      
      // Check and update release conditions
      await this.checkReleaseConditions(escrowId);
      
      logger.info('Escrow funded', {
        escrowId: escrow._id,
        transactionHash,
        fundedBy
      });
      
      return escrow;
    } catch (error) {
      logger.error('Error funding escrow:', error);
      throw error;
    }
  }
  
  /**
   * Release escrow funds to seller
   */
  async releaseEscrow(escrowId, releasedBy, signature = null) {
    try {
      const escrow = await Escrow.findById(escrowId)
        .populate('buyer seller');
      
      if (!escrow) {
        throw new Error('Escrow not found');
      }
      
      if (escrow.status !== 'funded' && escrow.status !== 'active') {
        throw new Error(`Cannot release escrow with status: ${escrow.status}`);
      }
      
      if (escrow.hasActiveDispute) {
        throw new Error('Cannot release escrow with active dispute');
      }
      
      // Check if user can perform release
      if (!escrow.canPerformAction(releasedBy, 'release')) {
        throw new Error('User not authorized to release escrow');
      }
      
      // Check multi-sig requirements
      if (escrow.requiresMultiSig) {
        // Add approval
        escrow.multiSigApprovals.push({
          user: releasedBy,
          action: 'release',
          approved: true,
          signature,
          approvedAt: new Date()
        });
        
        if (!escrow.hasRequiredApprovals('release')) {
          await escrow.save();
          return { status: 'pending_approval', escrow };
        }
      }
      
      // Process release (in production, this would trigger actual blockchain transaction)
      escrow.status = 'completed';
      escrow.releasedAt = new Date();
      escrow.addHistory('released', releasedBy, 'Funds released to seller');
      
      await escrow.save();
      
      logger.info('Escrow released', {
        escrowId: escrow._id,
        releasedBy,
        amount: escrow.amount
      });
      
      return { status: 'released', escrow };
    } catch (error) {
      logger.error('Error releasing escrow:', error);
      throw error;
    }
  }
  
  /**
   * Refund escrow funds to buyer
   */
  async refundEscrow(escrowId, refundedBy, reason) {
    try {
      const escrow = await Escrow.findById(escrowId)
        .populate('buyer seller');
      
      if (!escrow) {
        throw new Error('Escrow not found');
      }
      
      if (escrow.status !== 'funded' && escrow.status !== 'active') {
        throw new Error(`Cannot refund escrow with status: ${escrow.status}`);
      }
      
      // Check if user can perform refund
      if (!escrow.canPerformAction(refundedBy, 'refund')) {
        throw new Error('User not authorized to refund escrow');
      }
      
      // Check multi-sig requirements
      if (escrow.requiresMultiSig) {
        escrow.multiSigApprovals.push({
          user: refundedBy,
          action: 'refund',
          approved: true,
          approvedAt: new Date()
        });
        
        if (!escrow.hasRequiredApprovals('refund')) {
          await escrow.save();
          return { status: 'pending_approval', escrow };
        }
      }
      
      // Process refund
      escrow.status = 'refunded';
      escrow.refundedAt = new Date();
      escrow.addHistory('refunded', refundedBy, `Refunded: ${reason}`);
      
      await escrow.save();
      
      logger.info('Escrow refunded', {
        escrowId: escrow._id,
        refundedBy,
        reason
      });
      
      return { status: 'refunded', escrow };
    } catch (error) {
      logger.error('Error refunding escrow:', error);
      throw error;
    }
  }
  
  /**
   * File a dispute
   */
  async fileDispute(escrowId, filedBy, disputeData) {
    try {
      const escrow = await Escrow.findById(escrowId);
      
      if (!escrow) {
        throw new Error('Escrow not found');
      }
      
      if (escrow.status !== 'funded' && escrow.status !== 'active') {
        throw new Error('Can only dispute funded or active escrows');
      }
      
      if (!escrow.isParty(filedBy)) {
        throw new Error('Only escrow parties can file disputes');
      }
      
      // Check if there's already an open dispute
      if (escrow.hasActiveDispute) {
        throw new Error('An active dispute already exists for this escrow');
      }
      
      // Create dispute
      const dispute = {
        filedBy,
        reason: disputeData.reason,
        description: disputeData.description,
        evidence: disputeData.evidence || [],
        status: 'open'
      };
      
      escrow.disputes.push(dispute);
      escrow.status = 'disputed';
      escrow.addHistory('dispute_filed', filedBy, `Dispute filed: ${disputeData.reason}`);
      
      await escrow.save();
      
      logger.warn('Escrow dispute filed', {
        escrowId: escrow._id,
        filedBy,
        reason: disputeData.reason
      });
      
      return escrow;
    } catch (error) {
      logger.error('Error filing dispute:', error);
      throw error;
    }
  }
  
  /**
   * Resolve a dispute
   */
  async resolveDispute(escrowId, disputeId, resolution, resolvedBy) {
    try {
      const escrow = await Escrow.findById(escrowId);
      
      if (!escrow) {
        throw new Error('Escrow not found');
      }
      
      const dispute = escrow.disputes.id(disputeId);
      if (!dispute) {
        throw new Error('Dispute not found');
      }
      
      if (dispute.status === 'resolved' || dispute.status === 'closed') {
        throw new Error('Dispute already resolved');
      }
      
      // Update dispute
      dispute.status = 'resolved';
      dispute.resolution = resolution.type;
      dispute.resolutionDetails = resolution.details;
      dispute.resolvedBy = resolvedBy;
      dispute.resolvedAt = new Date();
      
      // Apply resolution
      switch (resolution.type) {
        case 'buyer_favor': {
          escrow.status = 'refunded';
          escrow.refundedAt = new Date();
          break;
        }
        case 'seller_favor': {
          escrow.status = 'completed';
          escrow.releasedAt = new Date();
          break;
        }
        case 'partial_refund': {
          // Handle partial refund logic
          escrow.status = 'completed';
          break;
        }
        case 'custom': {
          // Handle custom resolution
          break;
        }
        default:
          break;
      }
      
      escrow.addHistory('dispute_resolved', resolvedBy, 
        `Dispute resolved: ${resolution.type} - ${resolution.details}`);
      
      await escrow.save();
      
      logger.info('Dispute resolved', {
        escrowId: escrow._id,
        disputeId,
        resolution: resolution.type,
        resolvedBy
      });
      
      return escrow;
    } catch (error) {
      logger.error('Error resolving dispute:', error);
      throw error;
    }
  }
  
  /**
   * Complete a milestone
   */
  async completeMilestone(escrowId, milestoneId, completedBy) {
    try {
      const escrow = await Escrow.findById(escrowId);
      
      if (!escrow) {
        throw new Error('Escrow not found');
      }
      
      if (escrow.releaseType !== 'milestone_based') {
        throw new Error('Escrow is not milestone-based');
      }
      
      const milestone = escrow.milestones.id(milestoneId);
      if (!milestone) {
        throw new Error('Milestone not found');
      }
      
      if (milestone.status !== 'pending') {
        throw new Error('Milestone already completed or disputed');
      }
      
      // Update milestone
      milestone.status = 'completed';
      milestone.completedAt = new Date();
      milestone.approvedBy = completedBy;
      
      escrow.addHistory('milestone_completed', completedBy, 
        `Milestone completed: ${milestone.title}`);
      
      await escrow.save();
      
      // Check if all milestones are completed
      const allCompleted = escrow.milestones.every(m => m.status === 'completed' || m.status === 'released');
      if (allCompleted) {
        escrow.status = 'completed';
        await escrow.save();
      }
      
      logger.info('Milestone completed', {
        escrowId: escrow._id,
        milestoneId,
        completedBy
      });
      
      return escrow;
    } catch (error) {
      logger.error('Error completing milestone:', error);
      throw error;
    }
  }
  
  /**
   * Release milestone funds
   */
  async releaseMilestone(escrowId, milestoneId, releasedBy) {
    try {
      const escrow = await Escrow.findById(escrowId);
      
      if (!escrow) {
        throw new Error('Escrow not found');
      }
      
      const milestone = escrow.milestones.id(milestoneId);
      if (!milestone) {
        throw new Error('Milestone not found');
      }
      
      if (milestone.status !== 'completed') {
        throw new Error('Milestone must be completed before release');
      }
      
      // Update milestone
      milestone.status = 'released';
      milestone.releasedAt = new Date();
      
      escrow.addHistory('milestone_released', releasedBy, 
        `Milestone funds released: ${milestone.title}`);
      
      await escrow.save();
      
      logger.info('Milestone released', {
        escrowId: escrow._id,
        milestoneId,
        amount: milestone.amount
      });
      
      return escrow;
    } catch (error) {
      logger.error('Error releasing milestone:', error);
      throw error;
    }
  }
  
  /**
   * Check and update release conditions
   */
  async checkReleaseConditions(escrowId) {
    try {
      const escrow = await Escrow.findById(escrowId);
      
      if (!escrow || !escrow.releaseConditions || escrow.releaseConditions.length === 0) {
        return escrow;
      }
      
      let conditionsUpdated = false;
      
      for (const condition of escrow.releaseConditions) {
        if (condition.met) continue;
        
        switch (condition.type) {
          case 'time_based':
            if (new Date() >= new Date(condition.value)) {
              condition.met = true;
              condition.metAt = new Date();
              conditionsUpdated = true;
            }
            break;
          case 'delivery_confirmation':
            // This would be updated externally when delivery is confirmed
            break;
          case 'inspection_period': {
            const inspectionEndDate = new Date(
              escrow.fundedAt.getTime() + (condition.value * 24 * 60 * 60 * 1000)
            );
            if (new Date() >= inspectionEndDate) {
              condition.met = true;
              condition.metAt = new Date();
              conditionsUpdated = true;
            }
            break;
          }
          default:
            break;
        }
      }
      
      if (conditionsUpdated) {
        await escrow.save();
        
        // Auto-release if all conditions are met and auto-release is enabled
        if (escrow.allConditionsMet && escrow.releaseType === 'automatic') {
          await this.releaseEscrow(escrowId, escrow.seller, null);
        }
      }
      
      return escrow;
    } catch (error) {
      logger.error('Error checking release conditions:', error);
      throw error;
    }
  }
  
  /**
   * Calculate fees for escrow
   */
  calculateFees(amount, cryptocurrency) {
    const fees = [];
    
    // Platform fee (2%)
    fees.push({
      type: 'platform',
      amount: amount * 0.02,
      percentage: 2,
      paidBy: 'seller',
      status: 'pending'
    });
    
    // Blockchain fee (estimate based on cryptocurrency)
    const blockchainFees = {
      'BTC': 0.0001,
      'ETH': 0.001,
      'USDT': 0.001,
      'LTC': 0.001,
      'XRP': 0.00001
    };
    
    fees.push({
      type: 'blockchain',
      amount: blockchainFees[cryptocurrency] || 0.001,
      paidBy: 'buyer',
      status: 'pending'
    });
    
    return fees;
  }
  
  /**
   * Cancel an escrow (only if not funded)
   */
  async cancelEscrow(escrowId, cancelledBy, reason) {
    try {
      const escrow = await Escrow.findById(escrowId);
      
      if (!escrow) {
        throw new Error('Escrow not found');
      }
      
      if (escrow.status !== 'created') {
        throw new Error('Can only cancel unfunded escrows');
      }
      
      if (!escrow.canPerformAction(cancelledBy, 'cancel')) {
        throw new Error('User not authorized to cancel escrow');
      }
      
      escrow.status = 'cancelled';
      escrow.addHistory('cancelled', cancelledBy, reason || 'Escrow cancelled');
      
      await escrow.save();
      
      logger.info('Escrow cancelled', {
        escrowId: escrow._id,
        cancelledBy,
        reason
      });
      
      return escrow;
    } catch (error) {
      logger.error('Error cancelling escrow:', error);
      throw error;
    }
  }
  
  /**
   * Process expired escrows
   */
  async processExpiredEscrows() {
    try {
      const expiredEscrows = await Escrow.find({
        expiresAt: { $lt: new Date() },
        status: { $in: ['funded', 'active'] }
      });
      
      for (const escrow of expiredEscrows) {
        // Auto-release or refund based on configuration
        if (escrow.metadata.autoReleaseAfterDays) {
          await this.releaseEscrow(escrow._id, escrow.seller, null);
        } else {
          escrow.status = 'expired';
          escrow.addHistory('expired', null, 'Escrow expired');
          await escrow.save();
        }
      }
      
      logger.info(`Processed ${expiredEscrows.length} expired escrows`);
      
      return expiredEscrows.length;
    } catch (error) {
      logger.error('Error processing expired escrows:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new EscrowService();
