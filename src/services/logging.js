const winston = require('winston');
const logger = require('../utils/logger');

/**
 * Centralized Logging Service with ELK Integration
 * Provides structured logging with context and correlation IDs
 */
class LoggingService {
  constructor() {
    this.elkEnabled = process.env.ELK_ENABLED === 'true';
    this.elasticsearchUrl = process.env.ELASTICSEARCH_URL;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.correlationIds = new Map();
  }

  /**
   * Initialize ELK transport if enabled
   */
  async initialize() {
    if (!this.elkEnabled) {
      logger.info('ELK logging is disabled');
      return;
    }

    try {
      // Try to load winston-elasticsearch if available
      let ElasticsearchTransport;
      try {
        ElasticsearchTransport = require('winston-elasticsearch');
      } catch (err) {
        logger.warn('winston-elasticsearch not installed, ELK integration disabled');
        return;
      }

      const esTransportOpts = {
        level: this.logLevel,
        clientOpts: {
          node: this.elasticsearchUrl,
          maxRetries: 5,
          requestTimeout: 10000
        },
        index: 'cryptons-logs'
      };

      // Add transport to existing logger
      logger.add(new ElasticsearchTransport(esTransportOpts));
      logger.info('ELK transport initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ELK transport:', error);
    }
  }

  /**
   * Generate correlation ID for request tracking
   */
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set correlation ID for current request
   */
  setCorrelationId(requestId, correlationId) {
    this.correlationIds.set(requestId, correlationId);
  }

  /**
   * Get correlation ID for current request
   */
  getCorrelationId(requestId) {
    return this.correlationIds.get(requestId);
  }

  /**
   * Clean up old correlation IDs
   */
  cleanupCorrelationIds() {
    // Keep only the last 10000 correlation IDs
    if (this.correlationIds.size > 10000) {
      const entries = Array.from(this.correlationIds.entries());
      const toKeep = entries.slice(-10000);
      this.correlationIds.clear();
      toKeep.forEach(([key, value]) => {
        this.correlationIds.set(key, value);
      });
    }
  }

  /**
   * Log with structured context
   */
  logWithContext(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
      environment: process.env.NODE_ENV,
      service: 'cryptons-api'
    };

    logger[level](logEntry);
  }

  /**
   * Log API request
   */
  logRequest(req, res, duration) {
    const context = {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id
    };

    if (res.statusCode >= 400) {
      this.logWithContext('warn', 'API request error', context);
    } else {
      this.logWithContext('info', 'API request', context);
    }
  }

  /**
   * Log security event
   */
  logSecurityEvent(event, details) {
    this.logWithContext('warn', 'Security event', {
      event,
      ...details,
      category: 'security'
    });
  }

  /**
   * Log business event
   */
  logBusinessEvent(event, details) {
    this.logWithContext('info', 'Business event', {
      event,
      ...details,
      category: 'business'
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation, collection, duration, success = true) {
    this.logWithContext(success ? 'debug' : 'warn', 'Database operation', {
      operation,
      collection,
      duration,
      success,
      category: 'database'
    });
  }

  /**
   * Log cache operation
   */
  logCacheOperation(operation, key, hit, duration) {
    this.logWithContext('debug', 'Cache operation', {
      operation,
      key,
      hit,
      duration,
      category: 'cache'
    });
  }

  /**
   * Log external API call
   */
  logExternalApiCall(service, endpoint, duration, success = true) {
    this.logWithContext(success ? 'info' : 'warn', 'External API call', {
      service,
      endpoint,
      duration,
      success,
      category: 'external-api'
    });
  }

  /**
   * Get logging statistics
   */
  getStatistics() {
    return {
      elkEnabled: this.elkEnabled,
      logLevel: this.logLevel,
      activeCorrelationIds: this.correlationIds.size,
      elasticsearchUrl: this.elasticsearchUrl
    };
  }
}

module.exports = new LoggingService();
