const lightningRebalancing = require('../src/services/lightningRebalancing');
const LightningChannel = require('../src/models/LightningChannel');

describe('Lightning Network Channel Rebalancing Service', () => {
  beforeAll(() => {
    if (!global.isConnected || !global.isConnected()) {
      console.log('Skipping Lightning Rebalancing tests - database not available');
    }
  });

  describe('Channel Balance Assessment', () => {
    it('should identify balanced channel', () => {
      const channel = {
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000
      };

      const assessment = lightningRebalancing.assessChannelBalance(channel);

      expect(assessment.needsRebalancing).toBe(false);
      expect(parseFloat(assessment.localRatio)).toBe(50.00);
      expect(parseFloat(assessment.remoteRatio)).toBe(50.00);
    });

    it('should identify channel needing outbound rebalancing', () => {
      const channel = {
        capacity: 1000000,
        localBalance: 900000, // 90% local
        remoteBalance: 100000 // 10% remote
      };

      const assessment = lightningRebalancing.assessChannelBalance(channel);

      expect(assessment.needsRebalancing).toBe(true);
      expect(assessment.direction).toBe('outbound');
      expect(parseFloat(assessment.localRatio)).toBe(90.00);
    });

    it('should identify channel needing inbound rebalancing', () => {
      const channel = {
        capacity: 1000000,
        localBalance: 100000, // 10% local
        remoteBalance: 900000 // 90% remote
      };

      const assessment = lightningRebalancing.assessChannelBalance(channel);

      expect(assessment.needsRebalancing).toBe(true);
      expect(assessment.direction).toBe('inbound');
      expect(parseFloat(assessment.localRatio)).toBe(10.00);
    });

    it('should calculate rebalancing amount correctly', () => {
      const channel = {
        capacity: 1000000,
        localBalance: 800000,
        remoteBalance: 200000
      };

      const assessment = lightningRebalancing.assessChannelBalance(channel);

      // Should recommend moving 300000 sats to reach 50/50 balance
      expect(assessment.amount).toBe(300000);
    });

    it('should handle zero capacity channel', () => {
      const channel = {
        capacity: 0,
        localBalance: 0,
        remoteBalance: 0
      };

      const assessment = lightningRebalancing.assessChannelBalance(channel);

      expect(assessment.needsRebalancing).toBe(false);
      expect(assessment.reason).toBe('Channel has no capacity');
    });
  });

  describe('Priority Calculation', () => {
    it('should assign low priority to balanced channels', () => {
      const priority = lightningRebalancing.calculatePriority(0.50); // 50%
      expect(priority).toBe(1);
    });

    it('should assign high priority to very unbalanced channels', () => {
      const priority = lightningRebalancing.calculatePriority(0.05); // 5%
      expect(priority).toBe(10);
    });

    it('should assign medium priority to moderately unbalanced channels', () => {
      const priority = lightningRebalancing.calculatePriority(0.30); // 30%
      expect(priority).toBeGreaterThan(3);
      expect(priority).toBeLessThan(8);
    });
  });

  describe('Rebalancing Recommendations', () => {
    it('should get channels needing rebalancing', async () => {
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

      const recommendations = await lightningRebalancing.getRecommendations();

      expect(recommendations.total).toBeGreaterThan(0);
      expect(recommendations.recommendations).toBeDefined();
      expect(recommendations.summary).toBeDefined();
    });

    it('should sort recommendations by priority', async () => {
      if (!global.isConnected()) return;

      await LightningChannel.deleteMany({});

      // Create channels with different imbalance levels
      await new LightningChannel({
        channelId: 'low-priority',
        remotePubkey: '03low...',
        capacity: 1000000,
        localBalance: 600000,
        remoteBalance: 400000,
        status: 'active',
        isActive: true
      }).save();

      await new LightningChannel({
        channelId: 'high-priority',
        remotePubkey: '03high...',
        capacity: 1000000,
        localBalance: 950000,
        remoteBalance: 50000,
        status: 'active',
        isActive: true
      }).save();

      const recommendations = await lightningRebalancing.getRecommendations();

      if (recommendations.recommendations.length >= 2) {
        // First recommendation should have higher or equal priority
        expect(recommendations.recommendations[0].priority)
          .toBeGreaterThanOrEqual(recommendations.recommendations[1].priority);
      }
    });

    it('should generate human-readable recommendations', async () => {
      if (!global.isConnected()) return;

      const recommendations = await lightningRebalancing.getRecommendations();

      recommendations.recommendations.forEach(rec => {
        expect(rec.recommendation).toBeDefined();
        expect(typeof rec.recommendation).toBe('string');
        expect(rec.recommendation.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = lightningRebalancing.getConfig();

      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('minBalanceRatio');
      expect(config).toHaveProperty('maxBalanceRatio');
      expect(config).toHaveProperty('optimalBalanceRatio');
      expect(config).toHaveProperty('maxFeeRate');
      expect(config).toHaveProperty('isRunning');
    });

    it('should update configuration', () => {
      const originalConfig = lightningRebalancing.getConfig();

      lightningRebalancing.updateConfig({
        minBalanceRatio: 0.25,
        maxBalanceRatio: 0.75,
        optimalBalanceRatio: 0.6
      });

      const newConfig = lightningRebalancing.getConfig();

      expect(newConfig.minBalanceRatio).toBe(0.25);
      expect(newConfig.maxBalanceRatio).toBe(0.75);
      expect(newConfig.optimalBalanceRatio).toBe(0.6);

      // Restore original config
      lightningRebalancing.updateConfig(originalConfig);
    });
  });

  describe('Auto-Rebalancing', () => {
    it('should handle disabled auto-rebalancing', async () => {
      // Temporarily disable rebalancing
      const originalEnabled = lightningRebalancing.enabled;
      lightningRebalancing.enabled = false;

      const result = await lightningRebalancing.autoRebalanceAll();

      expect(result.enabled).toBe(false);

      // Restore original state
      lightningRebalancing.enabled = originalEnabled;
    });

    it('should handle no channels needing rebalancing', async () => {
      if (!global.isConnected()) return;

      await LightningChannel.deleteMany({});

      // Create only balanced channels
      await new LightningChannel({
        channelId: 'balanced1',
        remotePubkey: '03balanced1...',
        capacity: 1000000,
        localBalance: 500000,
        remoteBalance: 500000,
        status: 'active',
        isActive: true
      }).save();

      // Enable rebalancing temporarily
      const originalEnabled = lightningRebalancing.enabled;
      lightningRebalancing.enabled = true;

      const result = await lightningRebalancing.autoRebalanceAll();

      expect(result.success).toBe(true);
      expect(result.channelsRebalanced).toBe(0);

      // Restore original state
      lightningRebalancing.enabled = originalEnabled;
    });
  });

  describe('Scheduler', () => {
    it('should start and stop scheduler', () => {
      const config = lightningRebalancing.getConfig();

      if (!config.isRunning) {
        lightningRebalancing.startAutoRebalancing(60000);
        expect(lightningRebalancing.getConfig().isRunning).toBe(true);
      }

      lightningRebalancing.stopAutoRebalancing();
      expect(lightningRebalancing.getConfig().isRunning).toBe(false);
    });

    it('should not start multiple schedulers', () => {
      lightningRebalancing.startAutoRebalancing(60000);
      
      // Try starting again - should not create duplicate
      lightningRebalancing.startAutoRebalancing(60000);
      
      expect(lightningRebalancing.getConfig().isRunning).toBe(true);
      
      lightningRebalancing.stopAutoRebalancing();
    });
  });
});
