/**
 * Centralized Logging Configuration
 * Defines log levels, formats, transports, and retention policies
 */

module.exports = {
  // Enable/disable ELK stack integration
  elkEnabled: process.env.ELK_ENABLED === 'true',

  // Elasticsearch configuration
  elasticsearch: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    index: process.env.LOG_INDEX || 'cryptons-logs',
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD
  },

  // Log levels by environment
  levels: {
    production: 'info',
    staging: 'info',
    development: 'debug',
    test: 'error'
  },

  // Log format
  format: {
    // JSON format for production (easier to parse)
    production: 'json',
    
    // Pretty format for development
    development: 'pretty',
    
    // Include timestamps
    timestamp: true,
    
    // Include stack traces for errors
    stackTrace: true
  },

  // Log transports
  transports: {
    // Console logging
    console: {
      enabled: true,
      level: process.env.LOG_LEVEL || 'info',
      colorize: process.env.NODE_ENV !== 'production'
    },
    
    // File logging
    file: {
      enabled: true,
      directory: './logs',
      filename: {
        error: 'error.log',
        combined: 'combined.log',
        access: 'access.log'
      },
      maxSize: '20m',
      maxFiles: '14d',
      compress: true
    },
    
    // Elasticsearch logging
    elasticsearch: {
      enabled: process.env.ELK_ENABLED === 'true',
      level: 'info',
      index: 'cryptons-logs',
      bufferLimit: 100
    }
  },

  // Log categories
  categories: {
    application: {
      level: 'info',
      include: ['startup', 'shutdown', 'configuration']
    },
    
    api: {
      level: 'info',
      include: ['request', 'response', 'error']
    },
    
    database: {
      level: 'debug',
      include: ['query', 'connection', 'error']
    },
    
    security: {
      level: 'warn',
      include: ['authentication', 'authorization', 'suspicious_activity']
    },
    
    business: {
      level: 'info',
      include: ['transaction', 'order', 'user_activity']
    },
    
    external: {
      level: 'info',
      include: ['api_call', 'webhook', 'integration']
    },
    
    performance: {
      level: 'debug',
      include: ['slow_query', 'slow_request', 'resource_usage']
    }
  },

  // Sensitive data masking
  masking: {
    enabled: true,
    fields: [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
      'privateKey'
    ],
    replaceWith: '[REDACTED]'
  },

  // Log retention policy
  retention: {
    // Local file retention
    local: {
      error: '30d',
      combined: '14d',
      access: '7d'
    },
    
    // Elasticsearch retention
    elasticsearch: {
      raw: process.env.LOG_RETENTION_DAYS || '90d',
      aggregated: '365d'
    }
  },

  // Structured logging fields
  structuredFields: {
    // Always include these fields
    default: [
      'timestamp',
      'level',
      'message',
      'service',
      'environment',
      'version'
    ],
    
    // Request-specific fields
    request: [
      'correlationId',
      'method',
      'path',
      'statusCode',
      'duration',
      'ip',
      'userAgent',
      'userId'
    ],
    
    // Error-specific fields
    error: [
      'errorCode',
      'errorMessage',
      'stack',
      'context'
    ]
  },

  // Sampling for high-volume logs
  sampling: {
    enabled: process.env.NODE_ENV === 'production',
    
    // Sample successful requests (keep 10%)
    successfulRequests: {
      rate: 0.1
    },
    
    // Always log errors
    errors: {
      rate: 1.0
    },
    
    // Sample debug logs (keep 5%)
    debug: {
      rate: 0.05
    }
  },

  // Log aggregation
  aggregation: {
    enabled: true,
    
    // Aggregate similar logs within time window
    window: '5m',
    
    // Maximum occurrences before forcing log
    threshold: 100
  }
};
