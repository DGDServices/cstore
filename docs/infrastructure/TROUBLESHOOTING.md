# Infrastructure Troubleshooting Guide

Common infrastructure issues and their solutions.

## Table of Contents

- [Database Issues](#database-issues)
- [Cache Issues](#cache-issues)
- [Monitoring Issues](#monitoring-issues)
- [Performance Issues](#performance-issues)
- [Network Issues](#network-issues)
- [Backup Issues](#backup-issues)

## Database Issues

### MongoDB Connection Failed

**Symptoms**: Application cannot connect to database

**Diagnosis**:
```bash
# Check MongoDB status
docker ps | grep mongo

# Check MongoDB logs
docker logs cryptons-mongodb-primary

# Test connection
mongosh --uri="${MONGODB_URI}"
```

**Solutions**:
1. Verify MongoDB is running
2. Check connection string
3. Verify network connectivity
4. Check authentication credentials

### Replica Set Not Syncing

**Symptoms**: High replication lag

**Diagnosis**:
```bash
# Check replica set status
docker exec cryptons-mongodb-primary mongosh --eval "rs.status()"

# Check replication lag
docker exec cryptons-mongodb-primary mongosh --eval "rs.printSecondaryReplicationInfo()"
```

**Solutions**:
1. Check network between nodes
2. Verify oplog size is sufficient
3. Check for slow operations
4. Increase oplog retention

## Cache Issues

### Redis Connection Failed

**Symptoms**: Cache operations failing

**Diagnosis**:
```bash
# Check Redis status
docker ps | grep redis

# Test connection
redis-cli -h localhost -p 6379 ping

# Check Redis logs
docker logs cryptons-redis-master
```

**Solutions**:
1. Verify Redis is running
2. Check password configuration
3. Verify network connectivity
4. Check memory limits

### Low Cache Hit Rate

**Symptoms**: Poor cache performance

**Diagnosis**:
```bash
# Check cache stats
curl http://localhost:3000/api/metrics | grep cache

# Check Redis info
redis-cli INFO stats
```

**Solutions**:
1. Review cache TTL settings
2. Check cache key patterns
3. Verify cache invalidation logic
4. Increase cache memory limit

## Monitoring Issues

### Prometheus Not Scraping

**Symptoms**: No metrics in Grafana

**Diagnosis**:
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check application metrics endpoint
curl http://localhost:3000/api/metrics

# Check Prometheus logs
docker logs cryptons-prometheus
```

**Solutions**:
1. Verify scrape configuration
2. Check network connectivity
3. Verify metrics endpoint is exposed
4. Check authentication settings

### Grafana No Data

**Symptoms**: Dashboards show "No data"

**Diagnosis**:
```bash
# Test Prometheus connection
curl http://prometheus:9090/api/v1/query?query=up

# Check Grafana logs
docker logs cryptons-grafana

# Verify data source
curl http://localhost:3001/api/datasources
```

**Solutions**:
1. Verify Prometheus data source configuration
2. Check time range selection
3. Verify query syntax
4. Check Prometheus has data

## Performance Issues

### High Response Times

**Symptoms**: Slow API responses

**Diagnosis**:
```bash
# Check performance metrics
curl http://localhost:3000/api/performance

# Check slow queries
curl http://localhost:3000/api/performance | jq '.report.slowQueries'

# Monitor database
docker exec cryptons-mongodb-primary mongosh --eval "db.currentOp()"
```

**Solutions**:
1. Add database indexes
2. Optimize slow queries
3. Enable caching
4. Scale horizontally
5. Review query patterns

### High Memory Usage

**Symptoms**: Memory usage continuously increasing

**Diagnosis**:
```bash
# Check memory usage
curl http://localhost:3000/api/metrics | grep memory

# Get heap snapshot
curl http://localhost:3000/api/performance | jq '.report.memory'
```

**Solutions**:
1. Check for memory leaks
2. Restart application
3. Optimize memory usage
4. Increase container limits
5. Review large object handling

## Network Issues

### Connection Timeouts

**Symptoms**: Intermittent connection failures

**Diagnosis**:
```bash
# Test connectivity
curl -v http://localhost:3000/api/health

# Check network stats
netstat -an | grep ESTABLISHED

# Check firewall rules
iptables -L -n -v
```

**Solutions**:
1. Verify firewall rules
2. Check security groups
3. Increase timeout settings
4. Check network latency
5. Review load balancer configuration

### Rate Limiting Triggered

**Symptoms**: 429 Too Many Requests errors

**Diagnosis**:
```bash
# Check rate limit headers
curl -I http://localhost:3000/api/products

# Review logs
tail -f logs/combined.log | grep "429"
```

**Solutions**:
1. Adjust rate limit settings
2. Implement caching
3. Add IP whitelist
4. Use API keys for trusted clients

## Backup Issues

### Backup Failed

**Symptoms**: Backup script returns error

**Diagnosis**:
```bash
# Check backup logs
tail -100 /backups/backup.log

# Verify MongoDB access
mongosh --uri="${MONGODB_URI}" --eval "db.runCommand('ping')"

# Check disk space
df -h /backups
```

**Solutions**:
1. Check MongoDB connectivity
2. Verify disk space
3. Check permissions
4. Review backup configuration

### Restore Failed

**Symptoms**: Cannot restore from backup

**Diagnosis**:
```bash
# List backups
ls -lh /backups/

# Verify backup integrity
gunzip -t /backups/20250114_020000/cryptons/*.bson.gz

# Check MongoDB version compatibility
docker exec cryptons-mongodb-primary mongosh --eval "db.version()"
```

**Solutions**:
1. Verify backup files exist
2. Check MongoDB is running
3. Verify version compatibility
4. Use appropriate mongorestore flags

## Common Errors

### Error: ECONNREFUSED

**Cause**: Service not running or not accessible

**Solution**:
```bash
# Check service status
docker ps

# Start service
docker-compose up -d [service-name]

# Check network
docker network ls
docker network inspect cryptons-network
```

### Error: Authentication Failed

**Cause**: Invalid credentials

**Solution**:
```bash
# Verify credentials in .env
cat .env | grep PASSWORD

# Reset MongoDB password
docker exec cryptons-mongodb-primary mongosh --eval "
  use admin;
  db.changeUserPassword('admin', 'new-password');
"
```

### Error: Out of Memory

**Cause**: Insufficient memory allocated

**Solution**:
```bash
# Check memory limits
docker stats

# Increase limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G

# Restart with new limits
docker-compose up -d
```

## Debugging Tools

### Health Check

```bash
# Check overall health
curl http://localhost:3000/api/health | jq

# Check specific component
curl http://localhost:3000/api/health | jq '.checks.database'
```

### Logs

```bash
# Application logs
docker logs cryptons-app -f

# Database logs
docker logs cryptons-mongodb-primary -f

# All infrastructure logs
docker-compose -f infrastructure/docker-compose.monitoring.yml logs -f
```

### Metrics

```bash
# Get all metrics
curl http://localhost:3000/api/metrics

# Get specific metric
curl http://localhost:3000/api/metrics | grep http_requests_total

# Performance report
curl http://localhost:3000/api/performance | jq
```

## Getting Help

1. Check logs for error messages
2. Review relevant documentation
3. Search GitHub issues
4. Contact DevOps team
5. Create support ticket

## References

- [Docker Troubleshooting](https://docs.docker.com/config/daemon/)
- [MongoDB Troubleshooting](https://docs.mongodb.com/manual/faq/diagnostics/)
- [Redis Troubleshooting](https://redis.io/topics/problems)
