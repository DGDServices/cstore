# Centralized Logging Guide

Guide for using the ELK Stack (Elasticsearch, Logstash, Kibana) for centralized logging.

## Overview

- Centralized log aggregation
- Structured logging with context
- Log search and analysis
- Retention policies
- Correlation tracking

## Quick Start

```bash
# Start logging stack
docker-compose -f infrastructure/docker-compose.logging.yml up -d

# Access Kibana
open http://localhost:5601
```

## Configuration

### Enable ELK Logging

```bash
# .env
ELK_ENABLED=true
ELASTICSEARCH_URL=http://elasticsearch:9200
LOG_RETENTION_DAYS=90
LOG_LEVEL=info
```

## Log Levels

- **error**: Error events
- **warn**: Warning messages
- **info**: Informational messages
- **debug**: Debug information
- **http**: HTTP requests

## Structured Logging

```javascript
const loggingService = require('./services/logging');

// Log with context
loggingService.logWithContext('info', 'User logged in', {
  userId: user.id,
  ip: req.ip,
  userAgent: req.get('user-agent')
});

// Log security event
loggingService.logSecurityEvent('failed_login', {
  username: req.body.username,
  ip: req.ip,
  attempts: 3
});

// Log business event
loggingService.logBusinessEvent('order_completed', {
  orderId: order.id,
  amount: order.total,
  currency: 'USD'
});
```

## Searching Logs in Kibana

### Common Searches

```
# Find all errors
level:"error"

# Find logs for specific user
userId:"123456"

# Find slow requests
duration:>2000

# Find security events
category:"security"

# Date range
@timestamp:[now-1h TO now]
```

### Creating Visualizations

1. Go to Kibana → Visualize
2. Create new visualization
3. Select index pattern: `cryptons-logs-*`
4. Choose visualization type
5. Configure metrics and aggregations

## Log Retention

Managed automatically:
- Raw logs: 90 days (configurable)
- Aggregated logs: 365 days
- Compressed older logs

## Best Practices

1. **Use Structured Logging** - Include relevant context
2. **Correlation IDs** - Track requests across services
3. **Sensitive Data** - Never log passwords, tokens, or PII
4. **Appropriate Levels** - Use correct log levels
5. **Performance** - Don't log in tight loops

## Troubleshooting

### Elasticsearch Connection Failed

```bash
# Check Elasticsearch health
curl http://localhost:9200/_cluster/health

# Check logs
docker logs cryptons-elasticsearch
```

### Kibana Not Showing Logs

1. Create index pattern: `cryptons-logs-*`
2. Select `@timestamp` as time field
3. Refresh field list

## References

- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Kibana Documentation](https://www.elastic.co/guide/en/kibana/current/index.html)
