/**
 * Printify Configuration
 * Configuration for Printify API integration and order processing
 */

module.exports = {
  // API Configuration
  api: {
    enabled: process.env.PRINTIFY_ENABLED === 'true',
    token: process.env.PRINTIFY_API_TOKEN,
    shopId: process.env.PRINTIFY_SHOP_ID,
    baseURL: 'https://api.printify.com/v1',
    timeout: 30000,
    webhookSecret: process.env.PRINTIFY_WEBHOOK_SECRET
  },

  // Order processing settings
  orders: {
    // Auto-submit orders to production
    autoSubmit: process.env.PRINTIFY_AUTO_SUBMIT === 'true',
    
    // Order retry configuration
    maxRetries: 3,
    retryDelay: 30000, // 30 seconds
    
    // Order status sync interval
    statusSyncInterval: 300000, // 5 minutes
    
    // Webhook retry configuration
    webhookRetries: 5,
    webhookRetryDelay: 60000 // 1 minute
  },

  // Payment configuration for Printify orders
  payment: {
    // Primary payment method
    primaryMethod: process.env.PRINTIFY_PAYMENT_METHOD || 'stripe',
    
    // Payment gateway configurations
    stripe: {
      enabled: process.env.STRIPE_ENABLED === 'true',
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      connectAccountId: process.env.STRIPE_CONNECT_ACCOUNT_ID
    },
    
    paypal: {
      enabled: process.env.PAYPAL_ENABLED === 'true',
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      mode: process.env.PAYPAL_MODE || 'sandbox'
    }
  },

  // Shipping configuration
  shipping: {
    // Default shipping method
    defaultMethod: 'standard',
    
    // Shipping cost estimation
    estimateCosts: true,
    
    // Free shipping threshold (in USD)
    freeShippingThreshold: 50
  },

  // Product synchronization settings
  sync: {
    // Auto-sync products from Printify
    autoSync: process.env.PRINTIFY_AUTO_SYNC === 'true',
    
    // Sync interval
    syncInterval: 86400000, // 24 hours
    
    // Sync on startup
    syncOnStartup: false,
    
    // Batch size for syncing
    batchSize: 100
  },

  // Webhook configuration
  webhooks: {
    // Events to subscribe to
    subscribedEvents: [
      'order:created',
      'order:updated',
      'order:sent-to-production',
      'order:shipment:created',
      'order:shipment:delivered',
      'product:publish:started',
      'product:publish:succeeded'
    ],
    
    // Webhook verification
    verifySignature: true,
    
    // Webhook endpoint path
    endpointPath: '/api/printify/webhooks'
  },

  // Notification settings
  notifications: {
    // Email notifications for order events
    emailOnOrderPlaced: true,
    emailOnOrderShipped: true,
    emailOnOrderDelivered: true,
    emailOnOrderFailed: true,
    
    // Admin notifications
    notifyAdminOnFailure: true,
    adminEmail: process.env.ADMIN_EMAIL
  },

  // Error handling
  errorHandling: {
    // Log failed orders
    logFailedOrders: true,
    
    // Retry failed orders
    retryFailedOrders: true,
    
    // Alert on consecutive failures
    alertOnConsecutiveFailures: 3
  }
};
