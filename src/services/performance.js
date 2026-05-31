const logger = require('../utils/logger');

/**
 * Performance Monitoring Service
 * Tracks and analyzes application performance metrics
 */
class PerformanceService {
  constructor() {
    this.enabled = process.env.PERFORMANCE_MONITORING_ENABLED !== 'false';
    this.metrics = {
      endpoints: new Map(),
      slowQueries: [],
      memorySnapshots: []
    };
    this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10);
    this.slowRequestThreshold = parseInt(process.env.SLOW_REQUEST_THRESHOLD || '2000', 10);
  }

  /**
   * Record endpoint performance
   */
  recordEndpoint(method, path, duration, statusCode) {
    if (!this.enabled) return;

    const key = `${method} ${path}`;
    
    if (!this.metrics.endpoints.has(key)) {
      this.metrics.endpoints.set(key, {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errors: 0,
        durations: []
      });
    }

    const metric = this.metrics.endpoints.get(key);
    metric.count++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.count;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    
    if (statusCode >= 400) {
      metric.errors++;
    }

    // Keep last 100 durations for percentile calculations
    metric.durations.push(duration);
    if (metric.durations.length > 100) {
      metric.durations.shift();
    }

    // Log slow requests
    if (duration > this.slowRequestThreshold) {
      logger.warn('Slow request detected', {
        method,
        path,
        duration,
        threshold: this.slowRequestThreshold
      });
    }
  }

  /**
   * Record slow database query
   */
  recordSlowQuery(query, duration, collection) {
    if (!this.enabled) return;

    if (duration > this.slowQueryThreshold) {
      const slowQuery = {
        timestamp: new Date(),
        query,
        duration,
        collection
      };

      this.metrics.slowQueries.push(slowQuery);
      
      // Keep only last 50 slow queries
      if (this.metrics.slowQueries.length > 50) {
        this.metrics.slowQueries.shift();
      }

      logger.warn('Slow query detected', slowQuery);
    }
  }

  /**
   * Take memory snapshot
   */
  takeMemorySnapshot() {
    if (!this.enabled) return;

    const snapshot = {
      timestamp: new Date(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    this.metrics.memorySnapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.metrics.memorySnapshots.length > 100) {
      this.metrics.memorySnapshots.shift();
    }

    // Check for potential memory leaks
    if (this.metrics.memorySnapshots.length >= 10) {
      this.detectMemoryLeak();
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeak() {
    const snapshots = this.metrics.memorySnapshots;
    if (snapshots.length < 10) return;

    const recent = snapshots.slice(-10);
    const heapUsed = recent.map(s => s.memory.heapUsed);
    
    // Check if memory is consistently increasing
    let increasing = true;
    for (let i = 1; i < heapUsed.length; i++) {
      if (heapUsed[i] <= heapUsed[i - 1]) {
        increasing = false;
        break;
      }
    }

    if (increasing) {
      const growth = heapUsed[heapUsed.length - 1] - heapUsed[0];
      const growthPercent = (growth / heapUsed[0]) * 100;

      if (growthPercent > 20) {
        logger.warn('Potential memory leak detected', {
          growth: Math.round(growth / 1024 / 1024) + ' MB',
          growthPercent: growthPercent.toFixed(2) + '%',
          snapshots: heapUsed.length
        });
      }
    }
  }

  /**
   * Get performance report
   */
  getReport() {
    const report = {
      timestamp: new Date().toISOString(),
      endpoints: [],
      slowQueries: this.metrics.slowQueries,
      memory: this.getMemoryReport()
    };

    // Process endpoint metrics
    this.metrics.endpoints.forEach((metric, key) => {
      const durations = metric.durations.slice().sort((a, b) => a - b);
      const p50 = this.getPercentile(durations, 50);
      const p95 = this.getPercentile(durations, 95);
      const p99 = this.getPercentile(durations, 99);

      report.endpoints.push({
        endpoint: key,
        count: metric.count,
        avgDuration: Math.round(metric.avgDuration),
        minDuration: Math.round(metric.minDuration),
        maxDuration: Math.round(metric.maxDuration),
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
        errorRate: metric.count > 0 ? ((metric.errors / metric.count) * 100).toFixed(2) : 0
      });
    });

    // Sort by average duration (slowest first)
    report.endpoints.sort((a, b) => b.avgDuration - a.avgDuration);

    return report;
  }

  /**
   * Get memory report
   */
  getMemoryReport() {
    if (this.metrics.memorySnapshots.length === 0) {
      return null;
    }

    const latest = this.metrics.memorySnapshots[this.metrics.memorySnapshots.length - 1];
    const oldest = this.metrics.memorySnapshots[0];

    const growth = latest.memory.heapUsed - oldest.memory.heapUsed;
    const growthPercent = (growth / oldest.memory.heapUsed) * 100;

    return {
      current: {
        heapUsed: Math.round(latest.memory.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(latest.memory.heapTotal / 1024 / 1024) + ' MB',
        external: Math.round(latest.memory.external / 1024 / 1024) + ' MB',
        rss: Math.round(latest.memory.rss / 1024 / 1024) + ' MB'
      },
      growth: {
        absolute: Math.round(growth / 1024 / 1024) + ' MB',
        percent: growthPercent.toFixed(2) + '%',
        snapshots: this.metrics.memorySnapshots.length
      },
      uptime: Math.floor(latest.uptime) + ' seconds'
    };
  }

  /**
   * Calculate percentile
   */
  getPercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  /**
   * Get recommendations for optimization
   */
  getOptimizationRecommendations() {
    const recommendations = [];
    const report = this.getReport();

    // Check for slow endpoints
    const slowEndpoints = report.endpoints.filter(e => e.p95 > this.slowRequestThreshold);
    if (slowEndpoints.length > 0) {
      recommendations.push({
        type: 'slow_endpoints',
        severity: 'high',
        message: `${slowEndpoints.length} endpoint(s) have slow response times (p95 > ${this.slowRequestThreshold}ms)`,
        details: slowEndpoints.map(e => e.endpoint)
      });
    }

    // Check for high error rates
    const highErrorEndpoints = report.endpoints.filter(e => parseFloat(e.errorRate) > 5);
    if (highErrorEndpoints.length > 0) {
      recommendations.push({
        type: 'high_error_rate',
        severity: 'high',
        message: `${highErrorEndpoints.length} endpoint(s) have high error rates (> 5%)`,
        details: highErrorEndpoints.map(e => ({ endpoint: e.endpoint, errorRate: e.errorRate }))
      });
    }

    // Check for slow queries
    if (report.slowQueries.length > 10) {
      recommendations.push({
        type: 'slow_queries',
        severity: 'medium',
        message: `${report.slowQueries.length} slow queries detected`,
        details: 'Consider adding indexes or optimizing queries'
      });
    }

    // Check memory growth
    if (report.memory && parseFloat(report.memory.growth.percent) > 50) {
      recommendations.push({
        type: 'memory_growth',
        severity: 'medium',
        message: `Memory usage increased by ${report.memory.growth.percent}`,
        details: 'Monitor for potential memory leaks'
      });
    }

    return recommendations;
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      endpoints: new Map(),
      slowQueries: [],
      memorySnapshots: []
    };
  }

  /**
   * Start periodic memory monitoring
   */
  startMemoryMonitoring(interval = 60000) {
    if (!this.enabled) return;

    this.memoryMonitorInterval = setInterval(() => {
      this.takeMemorySnapshot();
    }, interval);

    logger.info(`Memory monitoring started (interval: ${interval}ms)`);
  }

  /**
   * Stop periodic memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
      logger.info('Memory monitoring stopped');
    }
  }
}

module.exports = new PerformanceService();
