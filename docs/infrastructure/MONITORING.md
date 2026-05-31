# Monitoring and Alerting Guide

Comprehensive guide for monitoring the Cryptons.com platform using Prometheus and Grafana.

## Overview

The monitoring stack provides:
- Real-time metrics collection (Prometheus)
- Visual dashboards (Grafana)
- Alerting and notifications (Alertmanager)
- System and application metrics
- Custom business metrics

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Metrics](#metrics)
- [Dashboards](#dashboards)
- [Alerting](#alerting)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Start Monitoring Stack

```bash
# Using npm script
npm run monitoring:setup

# Or manually
docker-compose -f infrastructure/docker-compose.monitoring.yml up -d
```

### 2. Access Dashboards

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: (from `GRAFANA_ADMIN_PASSWORD` env var)
- **Alertmanager**: http://localhost:9093

### 3. Verify Application Metrics

```bash
# Check metrics endpoint
curl http://localhost:3000/api/metrics
```

## Architecture

```
┌─────────────┐
│ Application │──┐
└─────────────┘  │
                 │  /metrics
┌─────────────┐  │
│ Node Export │──┼──> ┌────────────┐     ┌──────────┐
└─────────────┘  │    │ Prometheus │────>│ Grafana  │
                 │    └────────────┘     └──────────┘
┌─────────────┐  │           │
│  cAdvisor   │──┘           │
└─────────────┘              v
                      ┌──────────────┐
                      │ Alertmanager │
                      └──────────────┘
```

## Metrics

### System Metrics

Collected by Node Exporter:

- **CPU**: Usage, load average
- **Memory**: Total, used, available
- **Disk**: Usage, I/O operations
- **Network**: Bytes sent/received, errors

### Container Metrics

Collected by cAdvisor:

- Container CPU usage
- Container memory usage
- Container network I/O
- Container filesystem usage

### Application Metrics

Collected from `/api/metrics`:

#### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_errors_total` - Total HTTP errors
- `http_error_rate` - Error rate percentage
- `http_response_time_milliseconds` - Response time by percentile

#### Database Metrics
- `db_queries_total` - Total database queries
- `db_query_duration` - Query duration

#### Cache Metrics
- `cache_hits_total` - Total cache hits
- `cache_misses_total` - Total cache misses
- `cache_hit_rate` - Cache hit rate percentage

#### Business Metrics
- `transactions_total` - Total transactions
- `transaction_volume` - Transaction volume in USD
- `active_users` - Currently active users
- `order_value` - Average order value

### Custom Metrics Example

```javascript
const monitoringService = require('./services/monitoring');

// Record business metric
monitoringService.recordBusinessMetric('order_completed', orderValue);

// Record cache operation
monitoringService.recordCacheHit(true);

// Record database query
monitoringService.recordDbQuery(queryDuration);
```

## Dashboards

### System Overview Dashboard

Displays:
- CPU and memory usage
- Disk space
- Network throughput
- System uptime

**Access**: Grafana → Dashboards → System Overview

### Application Performance Dashboard

Displays:
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate
- Active connections

**Access**: Grafana → Dashboards → Application Performance

### Database Performance Dashboard

Displays:
- Query count
- Slow queries
- Connection pool usage
- Replica set status

**Access**: Grafana → Dashboards → Database Performance

### Business Metrics Dashboard

Displays:
- Transaction volume
- Active users
- Revenue metrics
- Conversion rates

**Access**: Grafana → Dashboards → Business Metrics

## Alerting

### Alert Rules

#### Critical Alerts (Immediate Response)

**ApplicationDown**
- **Condition**: Application is unreachable for > 1 minute
- **Action**: Page on-call engineer
- **Resolution**: Restart application, check logs

**HighErrorRate**
- **Condition**: Error rate > 5% for 5 minutes
- **Action**: Notify engineering team
- **Resolution**: Check application logs, rollback if needed

**HighMemoryUsage**
- **Condition**: Memory usage > 90% for 5 minutes
- **Action**: Alert engineering team
- **Resolution**: Restart application, investigate memory leak

**DatabaseConnectionFailed**
- **Condition**: Cannot connect to database for > 2 minutes
- **Action**: Page on-call engineer
- **Resolution**: Check database status, network connectivity

#### Warning Alerts (Response within 1 hour)

**SlowResponseTime**
- **Condition**: P95 response time > 2 seconds for 10 minutes
- **Action**: Notify engineering team
- **Resolution**: Investigate slow endpoints, optimize queries

**LowCacheHitRate**
- **Condition**: Cache hit rate < 50% for 15 minutes
- **Action**: Notify engineering team
- **Resolution**: Review cache strategy, check Redis health

**HighCPUUsage**
- **Condition**: CPU usage > 80% for 10 minutes
- **Action**: Notify engineering team
- **Resolution**: Scale horizontally, optimize code

### Alert Channels

Configure in `monitoring/alertmanager/config.yml`:

#### Email
```yaml
email_configs:
  - to: 'alerts@cryptons.com'
    from: 'monitoring@cryptons.com'
```

#### Slack
```yaml
slack_configs:
  - webhook_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
    channel: '#alerts'
```

#### Webhook
```yaml
webhook_configs:
  - url: 'https://api.pagerduty.com/incidents'
```

### Testing Alerts

```bash
# Trigger test alert
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning"
    },
    "annotations": {
      "summary": "Test alert"
    }
  }]'
```

## Configuration

### Prometheus Configuration

Edit `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'cryptons-api'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/metrics'
```

### Grafana Configuration

#### Add Data Source

1. Go to Configuration → Data Sources
2. Add Prometheus
3. URL: `http://prometheus:9090`
4. Click "Save & Test"

#### Import Dashboard

1. Go to Dashboards → Import
2. Upload JSON file from `monitoring/grafana/dashboards/`
3. Select Prometheus data source
4. Click "Import"

### Custom Metrics

#### Define New Metric

In `src/services/monitoring.js`:

```javascript
recordCustomMetric(name, value, labels = {}) {
  // Implementation
}
```

#### Use in Application

```javascript
const monitoring = require('./services/monitoring');

// Record metric
monitoring.recordCustomMetric('payment_processed', amount, {
  currency: 'BTC',
  status: 'success'
});
```

## Troubleshooting

### Metrics Not Showing in Grafana

**Problem**: Dashboard shows "No data"

**Solutions**:
1. Check Prometheus is scraping targets
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

2. Verify application is exposing metrics
   ```bash
   curl http://localhost:3000/api/metrics
   ```

3. Check Prometheus logs
   ```bash
   docker logs cryptons-prometheus
   ```

### Alert Not Firing

**Problem**: Expected alert is not triggering

**Solutions**:
1. Check alert rule syntax
   ```bash
   promtool check rules monitoring/alerts/*.yml
   ```

2. Verify alert is defined in Prometheus
   - Go to http://localhost:9090/alerts

3. Test alert rule manually
   - Go to http://localhost:9090/graph
   - Enter alert query

### High Cardinality Issues

**Problem**: Too many unique metric combinations

**Solutions**:
1. Reduce label cardinality
2. Use recording rules for aggregations
3. Increase Prometheus storage

## Best Practices

### Metric Naming

Follow Prometheus naming conventions:
- Use snake_case: `http_requests_total`
- Include unit suffix: `_seconds`, `_bytes`, `_total`
- Use descriptive names

### Label Usage

- Keep label cardinality low
- Don't use user IDs in labels
- Use consistent label names

### Dashboard Design

- One purpose per dashboard
- Use consistent time ranges
- Add helpful annotations
- Include links to runbooks

### Alert Design

- Alert on symptoms, not causes
- Provide actionable information
- Include links to dashboards
- Test alerts regularly

## Performance Tips

1. **Use Recording Rules** for expensive queries
   ```yaml
   groups:
     - name: api_performance
       interval: 30s
       rules:
         - record: api:request_rate:5m
           expr: rate(http_requests_total[5m])
   ```

2. **Optimize Query Range** - Use appropriate time windows

3. **Aggregate When Possible** - Reduce data points

4. **Use Caching** - Enable dashboard caching in Grafana

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node Exporter](https://github.com/prometheus/node_exporter)
- [cAdvisor](https://github.com/google/cadvisor)
