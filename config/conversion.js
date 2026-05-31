/**
 * Conversion Configuration
 * Settings for crypto-to-fiat conversion system
 */

module.exports = {
  // Conversion limits
  limits: {
    // Minimum conversion amount in USD equivalent
    minAmount: parseFloat(process.env.MIN_CONVERSION_AMOUNT) || 10,
    
    // Maximum conversion amount in USD equivalent
    maxAmount: parseFloat(process.env.MAX_CONVERSION_AMOUNT) || 10000,
    
    // Auto-approval limit (conversions below this don't need approval)
    autoApprovalLimit: parseFloat(process.env.AUTO_APPROVAL_LIMIT) || 1000,
    
    // Daily conversion limit per user
    dailyUserLimit: parseFloat(process.env.DAILY_USER_CONVERSION_LIMIT) || 50000,
    
    // Daily total conversion limit
    dailyTotalLimit: parseFloat(process.env.DAILY_TOTAL_CONVERSION_LIMIT) || 500000
  },

  // Risk management
  risk: {
    // Volatility threshold (percentage) - triggers manual approval
    volatilityThreshold: parseFloat(process.env.VOLATILITY_THRESHOLD) || 5,
    
    // Maximum allowed price slippage (percentage)
    maxSlippage: parseFloat(process.env.MAX_CONVERSION_SLIPPAGE) || 2,
    
    // Minimum confirmations required for crypto deposits
    minConfirmations: {
      BTC: 3,
      ETH: 12,
      USDT: 12,
      LTC: 6,
      XRP: 1,
      'BTC-LN': 0 // Lightning Network is instant
    },
    
    // Risk scoring weights
    riskWeights: {
      amount: 0.3,
      volatility: 0.3,
      userHistory: 0.2,
      exchangeHealth: 0.2
    },
    
    // Risk level thresholds (score 0-100)
    riskThresholds: {
      low: 30,
      medium: 60,
      high: 100
    }
  },

  // Processing configuration
  processing: {
    // Conversion execution timeout (milliseconds)
    executionTimeout: 120000, // 2 minutes
    
    // Maximum retry attempts
    maxRetries: 3,
    
    // Retry delay (milliseconds)
    retryDelay: 30000, // 30 seconds
    
    // Exponential backoff for retries
    exponentialBackoff: true,
    
    // Queue processing interval
    queueInterval: 10000, // 10 seconds
    
    // Batch processing size
    batchSize: 10
  },

  // Fee configuration
  fees: {
    // Base processing fee (percentage)
    processingFeePercentage: 0.5,
    
    // Minimum processing fee (USD)
    minProcessingFee: 1,
    
    // Maximum total fee percentage (including exchange fees)
    maxTotalFeePercentage: 3,
    
    // Fee calculation method
    feeCalculationMethod: 'percentage' // 'percentage' or 'fixed'
  },

  // Rate calculation
  rates: {
    // Rate provider priority
    providers: ['exchange', 'api', 'fallback'],
    
    // Rate refresh interval (milliseconds)
    refreshInterval: 60000, // 1 minute
    
    // Rate cache duration (milliseconds)
    cacheDuration: 60000, // 1 minute
    
    // Use mid-market rate or bid/ask
    useMarketRate: true,
    
    // Add spread to rate (percentage)
    spreadPercentage: 0.5
  },

  // Approval workflow
  approval: {
    // Require approval for high-risk conversions
    requireApprovalForHighRisk: true,
    
    // Require approval for amounts above limit
    requireApprovalAboveLimit: true,
    
    // Required approvers for high-value conversions
    requiredApprovers: 1,
    
    // Approval timeout (milliseconds)
    approvalTimeout: 3600000, // 1 hour
    
    // Auto-reject if approval times out
    autoRejectOnTimeout: false
  },

  // Notification settings
  notifications: {
    // Notify user on conversion start
    notifyOnStart: true,
    
    // Notify user on conversion complete
    notifyOnComplete: true,
    
    // Notify user on conversion failure
    notifyOnFailure: true,
    
    // Notify admin on large conversions
    notifyAdminOnLargeConversion: true,
    largeConversionThreshold: 5000,
    
    // Notify admin on failures
    notifyAdminOnFailure: true
  },

  // Monitoring and alerts
  monitoring: {
    // Track conversion success rate
    trackSuccessRate: true,
    
    // Alert if success rate drops below threshold
    successRateAlertThreshold: 95, // percentage
    
    // Track average conversion time
    trackAverageTime: true,
    
    // Alert if average time exceeds threshold
    avgTimeAlertThreshold: 300000, // 5 minutes
    
    // Alert on consecutive failures
    consecutiveFailureAlert: 3
  },

  // Supported currency pairs
  supportedPairs: {
    BTC: ['USD', 'EUR', 'GBP'],
    ETH: ['USD', 'EUR', 'GBP'],
    USDT: ['USD', 'EUR', 'GBP'],
    LTC: ['USD', 'EUR', 'GBP'],
    XRP: ['USD', 'EUR', 'GBP'],
    'BTC-LN': ['USD', 'EUR', 'GBP']
  },

  // Default fiat currency
  defaultFiatCurrency: 'USD'
};
