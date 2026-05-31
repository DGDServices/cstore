const logger = require('../utils/logger');

/**
 * Monitoring Service with Prometheus-style metrics
 * Collects system, application, and business metrics
 */
class MonitoringService {
  constructor() {
    this.enabled = process.env.PROMETHEUS_ENABLED === 'true';
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      responseTime: [],
      activeConnections: 0,
      dbQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      businessMetrics: new Map()
    };
    this.startTime = Date.now();
  }

  /**
   * Record HTTP request
   */
  recordRequest(method, path, statusCode, duration) {
    if (!this.enabled) return;

    const key = `${method}_${path}_${statusCode}`;
    const current = this.metrics.requests.get(key) || 0;
    this.metrics.requests.set(key, current + 1);

    // Record response time
    this.metrics.responseTime.push({
      timestamp: Date.now(),
      duration,
      path
    });

    // Keep only last 1000 response times
    if (this.metrics.responseTime.length > 1000) {
      this.metrics.responseTime.shift();
    }

    // Record errors
    if (statusCode >= 400) {
      const errorKey = `${statusCode}_${path}`;
      const errorCount = this.metrics.errors.get(errorKey) || 0;
      this.metrics.errors.set(errorKey, errorCount + 1);
    }
  }

  /**
   * Record database query
   */
  recordDbQuery(duration) {
    if (!this.enabled) return;
    this.metrics.dbQueries++;
  }

  /**
   * Record cache hit/miss
   */
  recordCacheHit(hit = true) {
    if (!this.enabled) return;
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }

  /**
   * Update active connections
   */
  updateActiveConnections(delta) {
    if (!this.enabled) return;
    this.metrics.activeConnections += delta;
  }

  /**
   * Record business metric
   */
  recordBusinessMetric(metric, value) {
    if (!this.enabled) return;
    
    const current = this.metrics.businessMetrics.get(metric) || { count: 0, total: 0 };
    current.count++;
    current.total += value;
    this.metrics.businessMetrics.set(metric, current);
  }

  /**
   * Get all metrics in Prometheus format
   */
  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    // Calculate response time percentiles
    const sortedTimes = this.metrics.responseTime
      .map(r => r.duration)
      .sort((a, b) => a - b);
    
    const p50 = this.getPercentile(sortedTimes, 50);
    const p95 = this.getPercentile(sortedTimes, 95);
    const p99 = this.getPercentile(sortedTimes, 99);
    const avgResponseTime = sortedTimes.length > 0
      ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length
      : 0;

    // Calculate cache hit rate
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0
      ? (this.metrics.cacheHits / totalCacheRequests) * 100
      : 0;

    // Calculate error rate
    let totalRequests = 0;
    let totalErrors = 0;
    this.metrics.requests.forEach((count, key) => {
      totalRequests += count;
      const statusCode = parseInt(key.split('_')[2], 10);
      if (statusCode >= 400) {
        totalErrors += count;
      }
    });
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      system: {
        uptime,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      application: {
        totalRequests,
        totalErrors,
        errorRate: errorRate.toFixed(2),
        activeConnections: this.metrics.activeConnections,
        responseTime: {
          avg: avgResponseTime.toFixed(2),
          p50: p50.toFixed(2),
          p95: p95.toFixed(2),
          p99: p99.toFixed(2)
        }
      },
      database: {
        totalQueries: this.metrics.dbQueries
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: cacheHitRate.toFixed(2)
      },
      business: Object.fromEntries(this.metrics.businessMetrics)
    };
  }

  /**
   * Get metrics in Prometheus text format
   */
  getPrometheusMetrics() {
    const metrics = this.getMetrics();
    let output = '';

    // System metrics
    output += `# HELP app_uptime_seconds Application uptime in seconds\n`;
    output += `# TYPE app_uptime_seconds counter\n`;
    output += `app_uptime_seconds ${metrics.system.uptime}\n\n`;

    output += `# HELP process_memory_bytes Memory usage in bytes\n`;
    output += `# TYPE process_memory_bytes gauge\n`;
    output += `process_memory_bytes{type="rss"} ${metrics.system.memory.rss}\n`;
    output += `process_memory_bytes{type="heapTotal"} ${metrics.system.memory.heapTotal}\n`;
    output += `process_memory_bytes{type="heapUsed"} ${metrics.system.memory.heapUsed}\n\n`;

    // Application metrics
    output += `# HELP http_requests_total Total HTTP requests\n`;
    output += `# TYPE http_requests_total counter\n`;
    output += `http_requests_total ${metrics.application.totalRequests}\n\n`;

    output += `# HELP http_errors_total Total HTTP errors\n`;
    output += `# TYPE http_errors_total counter\n`;
    output += `http_errors_total ${metrics.application.totalErrors}\n\n`;

    output += `# HELP http_error_rate Error rate percentage\n`;
    output += `# TYPE http_error_rate gauge\n`;
    output += `http_error_rate ${metrics.application.errorRate}\n\n`;

    output += `# HELP http_response_time_milliseconds HTTP response time\n`;
    output += `# TYPE http_response_time_milliseconds summary\n`;
    output += `http_response_time_milliseconds{quantile="0.5"} ${metrics.application.responseTime.p50}\n`;
    output += `http_response_time_milliseconds{quantile="0.95"} ${metrics.application.responseTime.p95}\n`;
    output += `http_response_time_milliseconds{quantile="0.99"} ${metrics.application.responseTime.p99}\n\n`;

    // Database metrics
    output += `# HELP db_queries_total Total database queries\n`;
    output += `# TYPE db_queries_total counter\n`;
    output += `db_queries_total ${metrics.database.totalQueries}\n\n`;

    // Cache metrics
    output += `# HELP cache_hits_total Total cache hits\n`;
    output += `# TYPE cache_hits_total counter\n`;
    output += `cache_hits_total ${metrics.cache.hits}\n\n`;

    output += `# HELP cache_misses_total Total cache misses\n`;
    output += `# TYPE cache_misses_total counter\n`;
    output += `cache_misses_total ${metrics.cache.misses}\n\n`;

    output += `# HELP cache_hit_rate Cache hit rate percentage\n`;
    output += `# TYPE cache_hit_rate gauge\n`;
    output += `cache_hit_rate ${metrics.cache.hitRate}\n\n`;

    return output;
  }

  /**
   * Calculate percentile
   */
  getPercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[index] || 0;
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    
    const checks = {
      memory: metrics.system.memory.heapUsed < metrics.system.memory.heapTotal * 0.9,
      errorRate: parseFloat(metrics.application.errorRate) < 5,
      responseTime: parseFloat(metrics.application.responseTime.p95) < 2000,
      cacheHitRate: parseFloat(metrics.cache.hitRate) > 70 || metrics.cache.hits + metrics.cache.misses === 0
    };

    const healthy = Object.values(checks).every(check => check);

    return {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      metrics: {
        errorRate: metrics.application.errorRate,
        responseTimeP95: metrics.application.responseTime.p95,
        cacheHitRate: metrics.cache.hitRate,
        memoryUsage: ((metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100).toFixed(2)
      }
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset() {
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      responseTime: [],
      activeConnections: 0,
      dbQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      businessMetrics: new Map()
    };
    this.startTime = Date.now();
  }
}

module.exports = new MonitoringService();
