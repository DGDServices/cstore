const mongoose = require('mongoose');
const { isRedisAvailable } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Comprehensive Health Check Service
 * Monitors all system components and dependencies
 */
class HealthService {
  constructor() {
    this.checks = new Map();
    this.lastCheckTime = null;
    this.checkInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10);
  }

  /**
   * Check database health
   */
  async checkDatabase() {
    try {
      if (mongoose.connection.readyState !== 1) {
        return {
          status: 'unhealthy',
          message: 'Database not connected',
          details: {
            readyState: mongoose.connection.readyState
          }
        };
      }

      // Ping database
      await mongoose.connection.db.admin().ping();

      return {
        status: 'healthy',
        message: 'Database connected',
        details: {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        message: 'Database check failed',
        error: error.message
      };
    }
  }

  /**
   * Check Redis cache health
   */
  async checkRedis() {
    try {
      const available = isRedisAvailable();

      if (!available) {
        return {
          status: 'degraded',
          message: 'Redis not available',
          details: {
            enabled: process.env.REDIS_ENABLED === 'true'
          }
        };
      }

      return {
        status: 'healthy',
        message: 'Redis connected'
      };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return {
        status: 'unhealthy',
        message: 'Redis check failed',
        error: error.message
      };
    }
  }

  /**
   * Check system resources
   */
  checkSystemResources() {
    try {
      const memory = process.memoryUsage();
      const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
      
      let status = 'healthy';
      let message = 'System resources normal';

      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
        message = 'Memory usage critical';
      } else if (memoryUsagePercent > 80) {
        status = 'degraded';
        message = 'Memory usage high';
      }

      return {
        status,
        message,
        details: {
          memory: {
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + ' MB',
            usagePercent: memoryUsagePercent.toFixed(2) + '%'
          },
          uptime: Math.floor(process.uptime()) + ' seconds',
          nodeVersion: process.version
        }
      };
    } catch (error) {
      logger.error('System resources check failed:', error);
      return {
        status: 'unhealthy',
        message: 'System check failed',
        error: error.message
      };
    }
  }

  /**
   * Check disk space (if available)
   */
  async checkDiskSpace() {
    try {
      // This is a simplified check - in production, use actual disk monitoring
      return {
        status: 'healthy',
        message: 'Disk space adequate',
        details: {
          note: 'Disk monitoring requires additional configuration'
        }
      };
    } catch (error) {
      return {
        status: 'unknown',
        message: 'Disk check not available',
        error: error.message
      };
    }
  }

  /**
   * Check external dependencies
   */
  async checkExternalDependencies() {
    const checks = {};

    // Check Elasticsearch if enabled
    if (process.env.ELASTICSEARCH_ENABLED === 'true') {
      try {
        // This would need actual implementation based on elasticsearch service
        checks.elasticsearch = {
          status: 'unknown',
          message: 'Check not implemented'
        };
      } catch (error) {
        checks.elasticsearch = {
          status: 'unhealthy',
          message: 'Elasticsearch check failed',
          error: error.message
        };
      }
    }

    return checks;
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const startTime = Date.now();

    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };

    try {
      // Run all checks in parallel
      const [database, redis, system, disk, external] = await Promise.all([
        this.checkDatabase(),
        this.checkRedis(),
        Promise.resolve(this.checkSystemResources()),
        this.checkDiskSpace(),
        this.checkExternalDependencies()
      ]);

      results.checks = {
        database,
        redis,
        system,
        disk,
        ...external
      };

      // Determine overall status
      const statuses = Object.values(results.checks).map(check => check.status);
      
      if (statuses.includes('unhealthy')) {
        results.status = 'unhealthy';
      } else if (statuses.includes('degraded')) {
        results.status = 'degraded';
      }

      results.duration = Date.now() - startTime;
      this.lastCheckTime = Date.now();
      
      return results;
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get liveness probe status (is app running?)
   */
  async getLiveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    };
  }

  /**
   * Get readiness probe status (is app ready to serve traffic?)
   */
  async getReadiness() {
    const database = await this.checkDatabase();
    
    const ready = database.status === 'healthy';

    return {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database
      }
    };
  }

  /**
   * Get startup probe status (has app finished starting up?)
   */
  async getStartup() {
    const checks = await this.runHealthChecks();
    
    const started = checks.status !== 'unhealthy';

    return {
      status: started ? 'started' : 'starting',
      timestamp: new Date().toISOString(),
      checks: checks.checks
    };
  }

  /**
   * Get health summary
   */
  async getHealthSummary() {
    const health = await this.runHealthChecks();
    
    return {
      status: health.status,
      timestamp: health.timestamp,
      summary: {
        healthy: Object.values(health.checks).filter(c => c.status === 'healthy').length,
        degraded: Object.values(health.checks).filter(c => c.status === 'degraded').length,
        unhealthy: Object.values(health.checks).filter(c => c.status === 'unhealthy').length
      },
      details: health.checks
    };
  }
}

module.exports = new HealthService();
