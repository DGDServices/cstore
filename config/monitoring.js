/**
 * Monitoring Configuration
 * Defines metrics collection, thresholds, and alerting rules
 */

module.exports = {
  // Enable/disable monitoring
  enabled: process.env.PROMETHEUS_ENABLED === 'true',

  // Metrics collection
  metrics: {
    // Collect system metrics every 30 seconds
    systemMetricsInterval: 30000,
    
    // Collect application metrics every 15 seconds
    appMetricsInterval: 15000,
    
    // Custom business metrics
    businessMetrics: [
      'total_transactions',
      'transaction_volume',
      'active_users',
      'conversion_rate',
      'order_value'
    ]
  },

  // Prometheus configuration
  prometheus: {
    port: parseInt(process.env.METRICS_PORT || '9090', 10),
    path: '/metrics',
    defaultLabels: {
      app: 'cryptons',
      environment: process.env.NODE_ENV || 'development'
    }
  },

  // Alerting thresholds
  thresholds: {
    // Response time thresholds (in ms)
    responseTime: {
      warning: 1000,
      critical: 2000
    },
    
    // Error rate thresholds (percentage)
    errorRate: {
      warning: 1,
      critical: 5
    },
    
    // Memory usage thresholds (percentage)
    memory: {
      warning: 80,
      critical: 90
    },
    
    // CPU usage thresholds (percentage)
    cpu: {
      warning: 70,
      critical: 90
    },
    
    // Disk space thresholds (percentage)
    disk: {
      warning: 80,
      critical: 90
    },
    
    // Cache hit rate threshold (percentage)
    cacheHitRate: {
      warning: 70,
      critical: 50
    },
    
    // Database query time (ms)
    dbQueryTime: {
      warning: 500,
      critical: 1000
    }
  },

  // Alert channels
  alerts: {
    webhook: {
      enabled: !!process.env.ALERT_WEBHOOK_URL,
      url: process.env.ALERT_WEBHOOK_URL,
      method: 'POST'
    },
    
    email: {
      enabled: !!process.env.ALERT_EMAIL,
      to: process.env.ALERT_EMAIL,
      from: process.env.SMTP_FROM_EMAIL
    },
    
    slack: {
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      url: process.env.SLACK_WEBHOOK_URL
    }
  },

  // Dashboard configuration
  dashboards: {
    // System overview dashboard
    system: {
      refreshInterval: 30,
      panels: [
        'cpu_usage',
        'memory_usage',
        'disk_usage',
        'network_io',
        'uptime'
      ]
    },
    
    // Application performance dashboard
    application: {
      refreshInterval: 15,
      panels: [
        'request_rate',
        'response_time',
        'error_rate',
        'active_connections',
        'cache_hit_rate'
      ]
    },
    
    // Business metrics dashboard
    business: {
      refreshInterval: 60,
      panels: [
        'active_users',
        'transactions',
        'revenue',
        'conversion_rate',
        'top_products'
      ]
    }
  },

  // Data retention
  retention: {
    // Keep raw metrics for 7 days
    raw: '7d',
    
    // Keep aggregated metrics for 30 days
    aggregated: '30d',
    
    // Keep summary metrics for 1 year
    summary: '365d'
  }
};
