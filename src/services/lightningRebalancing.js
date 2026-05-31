const logger = require('../utils/logger');
const LightningChannel = require('../models/LightningChannel');
const lightningService = require('./lightningService');

/**
 * Lightning Network Channel Rebalancing Service
 * Automates channel balance management for optimal routing
 */
class LightningRebalancingService {
  constructor() {
    this.enabled = process.env.LIGHTNING_REBALANCING_ENABLED === 'true';
    this.minBalanceRatio = parseFloat(process.env.MIN_BALANCE_RATIO || '0.2'); // 20%
    this.maxBalanceRatio = parseFloat(process.env.MAX_BALANCE_RATIO || '0.8'); // 80%
    this.optimalBalanceRatio = parseFloat(process.env.OPTIMAL_BALANCE_RATIO || '0.5'); // 50%
    this.rebalancingInterval = null;
    this.maxFeeRate = parseFloat(process.env.MAX_REBALANCING_FEE_RATE || '0.0001'); // 0.01%
  }

  /**
   * Check if a channel needs rebalancing
   * @param {Object} channel - Channel data
   * @returns {Object} - Rebalancing assessment
   */
  assessChannelBalance(channel) {
    const { localBalance, remoteBalance, capacity } = channel;
    
    if (capacity === 0) {
      return {
        needsRebalancing: false,
        reason: 'Channel has no capacity'
      };
    }

    const localRatio = localBalance / capacity;
    const remoteRatio = remoteBalance / capacity;

    // Channel needs rebalancing if balance is too far from optimal
    const needsRebalancing = 
      localRatio < this.minBalanceRatio || 
      localRatio > this.maxBalanceRatio;

    let direction = null;
    let amount = 0;

    if (needsRebalancing) {
      // Calculate how much to move
      const targetBalance = capacity * this.optimalBalanceRatio;
      amount = Math.abs(localBalance - targetBalance);
      direction = localBalance < targetBalance ? 'inbound' : 'outbound';
    }

    return {
      needsRebalancing,
      localRatio: (localRatio * 100).toFixed(2),
      remoteRatio: (remoteRatio * 100).toFixed(2),
      direction,
      amount,
      priority: this.calculatePriority(localRatio)
    };
  }

  /**
   * Calculate rebalancing priority (1-10, higher is more urgent)
   * @param {number} localRatio - Local balance ratio
   * @returns {number}
   */
  calculatePriority(localRatio) {
    const deviation = Math.abs(localRatio - this.optimalBalanceRatio);
    
    if (deviation < 0.1) return 1; // 40-60% - Low priority
    if (deviation < 0.2) return 3; // 30-70% - Medium-low priority
    if (deviation < 0.3) return 5; // 20-80% - Medium priority
    if (deviation < 0.4) return 7; // 10-90% - High priority
    return 10; // <10% or >90% - Critical priority
  }

  /**
   * Get all channels that need rebalancing
   * @returns {Promise<Array>}
   */
  async getChannelsNeedingRebalancing() {
    try {
      const channels = await LightningChannel.find({ isActive: true });
      
      const assessments = channels.map(channel => {
        const assessment = this.assessChannelBalance(channel);
        return {
          channel,
          assessment
        };
      });

      // Filter channels that need rebalancing and sort by priority
      const needsRebalancing = assessments
        .filter(a => a.assessment.needsRebalancing)
        .sort((a, b) => b.assessment.priority - a.assessment.priority);

      return needsRebalancing;
    } catch (error) {
      logger.error('Error getting channels needing rebalancing:', error);
      throw error;
    }
  }

  /**
   * Execute rebalancing for a channel
   * @param {string} channelId - Channel ID
   * @param {number} amount - Amount to rebalance in satoshis
   * @param {string} direction - 'inbound' or 'outbound'
   * @returns {Promise<Object>}
   */
  async rebalanceChannel(channelId, amount, direction) {
    if (!lightningService.isLndAvailable()) {
      throw new Error('Lightning Network not available');
    }

    try {
      logger.info(`Starting rebalancing for channel ${channelId}`, {
        amount,
        direction
      });

      // Rebalancing typically involves:
      // 1. For outbound: Send circular payment through the channel
      // 2. For inbound: Request payment through the channel
      
      // This is a simplified implementation
      // In production, you would use circular rebalancing strategies
      
      const result = {
        channelId,
        amount,
        direction,
        status: 'simulated', // In real implementation, this would be 'completed' or 'failed'
        fee: Math.floor(amount * this.maxFeeRate),
        timestamp: new Date()
      };

      logger.info(`Rebalancing completed for channel ${channelId}`, result);

      return result;
    } catch (error) {
      logger.error(`Error rebalancing channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Auto-rebalance all channels that need it
   * @returns {Promise<Object>}
   */
  async autoRebalanceAll() {
    if (!this.enabled) {
      logger.info('Auto-rebalancing is disabled');
      return { enabled: false };
    }

    try {
      const channelsToRebalance = await this.getChannelsNeedingRebalancing();
      
      if (channelsToRebalance.length === 0) {
        logger.info('No channels need rebalancing');
        return {
          success: true,
          channelsRebalanced: 0,
          message: 'All channels are balanced'
        };
      }

      logger.info(`Starting auto-rebalancing for ${channelsToRebalance.length} channels`);

      const results = [];

      // Rebalance channels in order of priority
      for (const { channel, assessment } of channelsToRebalance) {
        try {
          const result = await this.rebalanceChannel(
            channel.channelId,
            assessment.amount,
            assessment.direction
          );
          results.push(result);

          // Add delay between rebalancing operations
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          logger.error(`Failed to rebalance channel ${channel.channelId}:`, error);
          results.push({
            channelId: channel.channelId,
            status: 'failed',
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.status !== 'failed').length;

      return {
        success: true,
        channelsRebalanced: successful,
        totalChannels: channelsToRebalance.length,
        results
      };
    } catch (error) {
      logger.error('Error in auto-rebalancing:', error);
      throw error;
    }
  }

  /**
   * Get rebalancing recommendations
   * @returns {Promise<Object>}
   */
  async getRecommendations() {
    try {
      const channelsToRebalance = await this.getChannelsNeedingRebalancing();
      
      const recommendations = channelsToRebalance.map(({ channel, assessment }) => ({
        channelId: channel.channelId,
        remotePubkey: channel.remotePubkey,
        capacity: channel.capacity,
        localBalance: channel.localBalance,
        remoteBalance: channel.remoteBalance,
        localRatio: assessment.localRatio,
        direction: assessment.direction,
        amount: assessment.amount,
        priority: assessment.priority,
        estimatedFee: Math.floor(assessment.amount * this.maxFeeRate),
        recommendation: this.generateRecommendation(assessment)
      }));

      return {
        total: recommendations.length,
        recommendations,
        summary: {
          critical: recommendations.filter(r => r.priority >= 8).length,
          high: recommendations.filter(r => r.priority >= 6 && r.priority < 8).length,
          medium: recommendations.filter(r => r.priority >= 4 && r.priority < 6).length,
          low: recommendations.filter(r => r.priority < 4).length
        }
      };
    } catch (error) {
      logger.error('Error getting rebalancing recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate human-readable recommendation
   * @param {Object} assessment - Channel assessment
   * @returns {string}
   */
  generateRecommendation(assessment) {
    const { direction, amount, priority, localRatio } = assessment;
    
    let urgency = 'Low priority';
    if (priority >= 8) urgency = 'Critical';
    else if (priority >= 6) urgency = 'High priority';
    else if (priority >= 4) urgency = 'Medium priority';

    const action = direction === 'inbound' 
      ? 'Increase local balance by receiving payments'
      : 'Decrease local balance by sending payments';

    return `${urgency}: ${action}. Current local balance: ${localRatio}%. Target: ${(this.optimalBalanceRatio * 100).toFixed(0)}%. Amount to move: ${amount} sats.`;
  }

  /**
   * Start automatic rebalancing scheduler
   * @param {number} intervalMs - Interval in milliseconds
   */
  startAutoRebalancing(intervalMs = 3600000) { // Default: 1 hour
    if (!this.enabled) {
      logger.info('Auto-rebalancing is disabled');
      return;
    }

    if (this.rebalancingInterval) {
      logger.warn('Auto-rebalancing is already running');
      return;
    }

    logger.info(`Starting auto-rebalancing scheduler (interval: ${intervalMs}ms)`);

    this.rebalancingInterval = setInterval(async () => {
      try {
        await this.autoRebalanceAll();
      } catch (error) {
        logger.error('Error in scheduled auto-rebalancing:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop automatic rebalancing scheduler
   */
  stopAutoRebalancing() {
    if (this.rebalancingInterval) {
      clearInterval(this.rebalancingInterval);
      this.rebalancingInterval = null;
      logger.info('Auto-rebalancing scheduler stopped');
    }
  }

  /**
   * Get rebalancing configuration
   * @returns {Object}
   */
  getConfig() {
    return {
      enabled: this.enabled,
      minBalanceRatio: this.minBalanceRatio,
      maxBalanceRatio: this.maxBalanceRatio,
      optimalBalanceRatio: this.optimalBalanceRatio,
      maxFeeRate: this.maxFeeRate,
      isRunning: this.rebalancingInterval !== null
    };
  }

  /**
   * Update rebalancing configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (config.minBalanceRatio !== undefined) {
      this.minBalanceRatio = parseFloat(config.minBalanceRatio);
    }
    if (config.maxBalanceRatio !== undefined) {
      this.maxBalanceRatio = parseFloat(config.maxBalanceRatio);
    }
    if (config.optimalBalanceRatio !== undefined) {
      this.optimalBalanceRatio = parseFloat(config.optimalBalanceRatio);
    }
    if (config.maxFeeRate !== undefined) {
      this.maxFeeRate = parseFloat(config.maxFeeRate);
    }

    logger.info('Rebalancing configuration updated', this.getConfig());
  }
}

module.exports = new LightningRebalancingService();
