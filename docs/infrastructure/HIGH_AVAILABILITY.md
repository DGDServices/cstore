# High Availability Configuration

Guide for configuring MongoDB replica sets and Redis for high availability.

## Overview

High availability features:
- MongoDB replica set with automatic failover
- Redis master-replica with Sentinel
- Connection pooling
- Automatic retry logic
- Health monitoring

## MongoDB Replica Set

### Setup

```bash
# Start replica set
docker-compose -f infrastructure/docker-compose.database.yml up -d

# Wait for initialization
docker logs cryptons-mongodb-rs-init
```

### Configuration

```bash
# .env
MONGODB_REPLICA_SET=cryptons-rs
MONGODB_REPLICA_MEMBERS=mongodb-primary:27017,mongodb-secondary1:27017,mongodb-secondary2:27017
MONGODB_READ_PREFERENCE=primaryPreferred
MONGODB_WRITE_CONCERN=majority
```

### Read Preferences

- **primary**: Read from primary only
- **primaryPreferred**: Prefer primary, fall back to secondary
- **secondary**: Read from secondary only
- **secondaryPreferred**: Prefer secondary, fall back to primary
- **nearest**: Read from nearest member

### Write Concerns

- **majority**: Wait for majority acknowledgment
- **1**: Wait for primary acknowledgment
- **0**: No acknowledgment (fire and forget)

## Redis High Availability

### Master-Replica Setup

Redis Sentinel automatically monitors and manages failover:

```bash
# Redis Sentinel is included in docker-compose.database.yml
docker ps | grep redis
```

### Configuration

```bash
# .env
REDIS_CLUSTER_ENABLED=true
REDIS_PASSWORD=your-secure-password
```

## Connection Pooling

### MongoDB Pool

```javascript
// Configured in config/database-ha.js
{
  minPoolSize: 5,
  maxPoolSize: 20,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000
}
```

### Redis Pool

```javascript
// Configured in config/cache.js
{
  pool: {
    min: 2,
    max: 10
  }
}
```

## Failover Testing

### Test MongoDB Failover

```bash
# Stop primary
docker stop cryptons-mongodb-primary

# Verify application continues
curl http://localhost:3000/api/health

# Check replica set status
docker exec cryptons-mongodb-secondary1 mongosh --eval "rs.status()"
```

### Test Redis Failover

```bash
# Stop Redis master
docker stop cryptons-redis-master

# Sentinel automatically promotes replica
docker logs cryptons-redis-sentinel

# Verify application continues
curl http://localhost:3000/api/health
```

## Monitoring

### Health Checks

```bash
# Check database health
curl http://localhost:3000/api/health

# Get detailed status
curl http://localhost:3000/api/health | jq '.checks.database'
```

### Replica Set Status

```bash
# Connect to MongoDB
docker exec -it cryptons-mongodb-primary mongosh

# Check replica set status
rs.status()

# Check replication lag
rs.printReplicationInfo()
rs.printSecondaryReplicationInfo()
```

## Disaster Recovery

### Recovery Time Objective (RTO)

- Automatic failover: < 30 seconds
- Manual intervention: < 5 minutes

### Recovery Point Objective (RPO)

- With majority write concern: 0 (no data loss)
- With w:1: May lose uncommitted writes

## Best Practices

1. **Use Majority Write Concern** - Prevents data loss
2. **Monitor Replication Lag** - Alert if lag > 10 seconds
3. **Test Failover Regularly** - Monthly failover drills
4. **Proper Indexing** - Optimize query performance
5. **Connection Pooling** - Reuse connections efficiently

## Troubleshooting

### Replica Set Not Initializing

```bash
# Check logs
docker logs cryptons-mongodb-rs-init

# Manually initialize
docker exec -it cryptons-mongodb-primary mongosh --eval "rs.initiate()"
```

### High Replication Lag

```bash
# Check network connectivity
docker exec cryptons-mongodb-primary ping mongodb-secondary1

# Check oplog size
docker exec cryptons-mongodb-primary mongosh --eval "rs.printReplicationInfo()"
```

### Connection Pool Exhausted

```bash
# Increase pool size
MONGODB_POOL_SIZE=50

# Check active connections
docker exec cryptons-mongodb-primary mongosh --eval "db.serverStatus().connections"
```

## References

- [MongoDB Replication](https://docs.mongodb.com/manual/replication/)
- [Redis Sentinel](https://redis.io/topics/sentinel)
- [Connection Pooling Best Practices](https://docs.mongodb.com/manual/administration/connection-pool-overview/)
