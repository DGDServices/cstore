# Performance Tuning Guide

Guide for optimizing the Cryptons.com platform performance.

## Overview

Performance optimization areas:
- Caching strategies
- Database optimization
- Application optimization
- Infrastructure optimization

## Caching

### Enable Redis Caching

```bash
# .env
CACHE_ENABLED=true
CACHE_TTL=3600
REDIS_URL=redis://localhost:6379
```

### Cache Strategies

```javascript
const cacheService = require('./services/cache');

// Cache-aside pattern
const getProduct = async (id) => {
  return await cacheService.getOrSet(
    `product:${id}`,
    () => Product.findById(id),
    3600
  );
};

// Cache middleware for routes
router.get('/products',
  cacheService.middleware(300), // 5 minutes
  getProducts
);
```

### Cache Invalidation

```javascript
// Invalidate on update
await cacheService.invalidateEntity('product', productId);

// Pattern-based invalidation
await cacheService.delPattern('products:*');
```

## Database Optimization

### Indexing

```javascript
// Create indexes
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, price: -1 });
productSchema.index({ createdAt: -1 });

// Check index usage
db.products.aggregate([
  { $indexStats: {} }
]);
```

### Query Optimization

```javascript
// Use lean() for read-only queries
const products = await Product.find().lean();

// Select only needed fields
const users = await User.find().select('name email');

// Use pagination
const products = await Product.find()
  .limit(20)
  .skip(page * 20);
```

### Connection Pooling

```bash
# .env
MONGODB_POOL_SIZE=20
MONGODB_POOL_MIN=5
```

## Application Optimization

### Compression

```javascript
// Enable gzip compression
const compression = require('compression');
app.use(compression());
```

### Response Optimization

```javascript
// Stream large responses
res.setHeader('Content-Type', 'application/json');
res.write('[');
cursor.on('data', (doc) => {
  res.write(JSON.stringify(doc) + ',');
});
cursor.on('end', () => {
  res.write(']');
  res.end();
});
```

### Rate Limiting

```javascript
// Prevent abuse
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api/', limiter);
```

## Infrastructure Optimization

### PM2 Clustering

```bash
# Start with PM2
pm2 start server-new.js -i max

# Or configure in ecosystem.config.js
module.exports = {
  apps: [{
    name: 'cryptons',
    script: 'server-new.js',
    instances: 'max',
    exec_mode: 'cluster'
  }]
};
```

### Resource Limits

```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Performance Monitoring

### Metrics to Track

```javascript
const performanceService = require('./services/performance');

// View performance report
app.get('/api/performance', (req, res) => {
  const report = performanceService.getReport();
  res.json(report);
});

// Get optimization recommendations
const recommendations = performanceService.getOptimizationRecommendations();
```

### Key Metrics

- Response time (p50, p95, p99)
- Error rate
- Cache hit rate
- Database query time
- Memory usage
- CPU usage

## Load Testing

### Using k6

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 }
  ]
};

export default function() {
  let res = http.get('http://localhost:3000/api/products');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500
  });
  sleep(1);
}
```

Run test:
```bash
k6 run loadtest.js
```

## Optimization Checklist

### Application
- [x] Enable caching
- [x] Implement compression
- [x] Optimize database queries
- [x] Add proper indexes
- [x] Use connection pooling
- [x] Implement rate limiting

### Database
- [x] Create indexes for common queries
- [x] Use replica sets for read scaling
- [x] Monitor slow queries
- [x] Optimize connection pool size
- [x] Regular cleanup of old data

### Infrastructure
- [x] Use CDN for static assets
- [x] Enable HTTP/2
- [x] Implement load balancing
- [x] Auto-scaling configuration
- [x] Resource monitoring

## Best Practices

1. **Measure First** - Profile before optimizing
2. **Cache Strategically** - Cache expensive operations
3. **Optimize Queries** - Use explain plans
4. **Scale Horizontally** - Add more instances
5. **Monitor Continuously** - Track performance metrics

## Troubleshooting

### Slow Response Times

```bash
# Check slow endpoints
curl http://localhost:3000/api/performance | jq '.report.endpoints'

# Review slow queries
curl http://localhost:3000/api/performance | jq '.report.slowQueries'
```

### High Memory Usage

```bash
# Check memory trends
curl http://localhost:3000/api/performance | jq '.report.memory'

# Heap dump analysis
node --inspect server-new.js
```

### Low Cache Hit Rate

```bash
# Check cache stats
curl http://localhost:3000/api/metrics | grep cache

# Review cache configuration
cat config/cache.js
```

## References

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [MongoDB Performance](https://docs.mongodb.com/manual/administration/analyzing-mongodb-performance/)
- [Redis Best Practices](https://redis.io/topics/optimization)
