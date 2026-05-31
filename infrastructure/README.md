# Cryptons Infrastructure

Production-grade infrastructure for the Cryptons.com cryptocurrency trading platform.

## Overview

This directory contains Docker Compose configurations and scripts for deploying a complete infrastructure stack including:

- **Monitoring**: Prometheus + Grafana
- **Logging**: Elasticsearch + Logstash + Kibana (ELK Stack)
- **Database HA**: MongoDB Replica Set + Redis with Sentinel
- **Alerting**: Alertmanager with multiple notification channels

## Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ RAM
- 50GB+ Disk Space

### 1. Start All Infrastructure

```bash
# From project root
npm run infrastructure:up

# Or manually
docker-compose -f infrastructure/docker-compose.monitoring.yml \
               -f infrastructure/docker-compose.logging.yml \
               -f infrastructure/docker-compose.database.yml \
               up -d
```

### 2. Verify Services

```bash
# Check all containers
docker ps

# Check specific service
docker logs cryptons-prometheus
docker logs cryptons-grafana
docker logs cryptons-elasticsearch
```

### 3. Access Dashboards

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Prometheus | http://localhost:9090 | None |
| Grafana | http://localhost:3001 | admin / (from env) |
| Kibana | http://localhost:5601 | None |
| Alertmanager | http://localhost:9093 | None |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Application Layer                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  API     │  │  Worker  │  │  Cron    │           │
│  │  Server  │  │  Process │  │  Jobs    │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │             │              │                  │
└───────┼─────────────┼──────────────┼──────────────────┘
        │             │              │
┌───────┼─────────────┼──────────────┼──────────────────┐
│       │  Infrastructure Layer      │                  │
│  ┌────▼─────┐  ┌───▼──────┐  ┌───▼──────┐           │
│  │ MongoDB  │  │  Redis   │  │  ElasticS│           │
│  │ Replica  │  │  Cluster │  │  -earch  │           │
│  │   Set    │  │          │  │          │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │Prometheus│  │ Grafana  │  │  Kibana  │           │
│  └──────────┘  └──────────┘  └──────────┘           │
└───────────────────────────────────────────────────────┘
```

## Stack Components

### Monitoring Stack

**File**: `docker-compose.monitoring.yml`

Components:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Node Exporter**: System metrics
- **cAdvisor**: Container metrics
- **Alertmanager**: Alert routing and notification

Ports:
- 9090: Prometheus
- 3001: Grafana
- 9100: Node Exporter
- 8080: cAdvisor
- 9093: Alertmanager

### Logging Stack

**File**: `docker-compose.logging.yml`

Components:
- **Elasticsearch**: Log storage and search
- **Logstash**: Log processing and enrichment
- **Kibana**: Log visualization
- **Filebeat**: Log shipping

Ports:
- 9200: Elasticsearch
- 5601: Kibana
- 5000: Logstash

### Database Stack

**File**: `docker-compose.database.yml`

Components:
- **MongoDB Primary**: Primary database node
- **MongoDB Secondary 1**: Replica node
- **MongoDB Secondary 2**: Replica node
- **Redis Master**: Cache master
- **Redis Replica**: Cache replica
- **Redis Sentinel**: Failover manager

Ports:
- 27017: MongoDB Primary
- 27018: MongoDB Secondary 1
- 27019: MongoDB Secondary 2
- 6379: Redis Master
- 6380: Redis Replica
- 26379: Redis Sentinel

## Configuration

### Environment Variables

Create `.env` in project root:

```bash
# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Logging
ELK_ENABLED=true
ELASTICSEARCH_URL=http://elasticsearch:9200
LOG_RETENTION_DAYS=90

# Database
MONGODB_REPLICA_SET=cryptons-rs
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-secure-password

# Redis
REDIS_PASSWORD=your-secure-password

# Backups
BACKUP_ENABLED=true
AWS_S3_BACKUP_BUCKET=cryptons-backups

# Alerts
ALERT_EMAIL=alerts@cryptons.com
ALERT_WEBHOOK_URL=https://hooks.slack.com/your-webhook
```

### Scaling

Scale specific services:

```bash
# Scale application servers
docker-compose up -d --scale app=3

# Scale Redis replicas
docker-compose -f infrastructure/docker-compose.database.yml \
  up -d --scale redis-replica=2
```

## Management

### Start Services

```bash
# Start all
npm run infrastructure:up

# Start specific stack
docker-compose -f infrastructure/docker-compose.monitoring.yml up -d
docker-compose -f infrastructure/docker-compose.logging.yml up -d
docker-compose -f infrastructure/docker-compose.database.yml up -d
```

### Stop Services

```bash
# Stop all
npm run infrastructure:down

# Stop specific stack
docker-compose -f infrastructure/docker-compose.monitoring.yml down
```

### View Logs

```bash
# All logs
docker-compose -f infrastructure/docker-compose.monitoring.yml logs -f

# Specific service
docker logs cryptons-prometheus -f
```

### Restart Services

```bash
# Restart specific service
docker restart cryptons-prometheus

# Restart all monitoring
docker-compose -f infrastructure/docker-compose.monitoring.yml restart
```

## Backup & Recovery

### Automated Backups

```bash
# Run backup
npm run backup

# Restore from backup
npm run restore
```

See [Backup & Recovery Guide](../docs/infrastructure/BACKUP_RECOVERY.md)

## Monitoring & Alerts

### Access Grafana

1. Go to http://localhost:3001
2. Login with admin credentials
3. Navigate to Dashboards

### Configure Alerts

Edit `../monitoring/alerts/application-alerts.yml`

See [Monitoring Guide](../docs/infrastructure/MONITORING.md)

## Maintenance

### Cleanup

```bash
# Run cleanup script
npm run cleanup

# Remove old backups and logs
npm run cleanup -- --backup-retention 7 --log-retention 7
```

### Update Images

```bash
# Pull latest images
docker-compose -f infrastructure/docker-compose.monitoring.yml pull

# Recreate containers
docker-compose -f infrastructure/docker-compose.monitoring.yml up -d
```

## Troubleshooting

### Common Issues

**Issue**: Containers won't start
```bash
# Check logs
docker logs [container-name]

# Check resources
docker system df
```

**Issue**: Cannot connect to service
```bash
# Check if running
docker ps | grep [service]

# Check network
docker network inspect cryptons-monitoring
```

See [Troubleshooting Guide](../docs/infrastructure/TROUBLESHOOTING.md)

## Documentation

- [Backup & Recovery](../docs/infrastructure/BACKUP_RECOVERY.md)
- [Monitoring Guide](../docs/infrastructure/MONITORING.md)
- [Logging Guide](../docs/infrastructure/LOGGING.md)
- [High Availability](../docs/infrastructure/HIGH_AVAILABILITY.md)
- [Performance Tuning](../docs/infrastructure/PERFORMANCE_TUNING.md)
- [Network Security](../docs/infrastructure/NETWORK_SECURITY.md)
- [Troubleshooting](../docs/infrastructure/TROUBLESHOOTING.md)

## Security Considerations

1. **Change Default Passwords**: Update all default passwords in `.env`
2. **Network Isolation**: Use Docker networks for service isolation
3. **TLS/SSL**: Enable SSL for production deployments
4. **Access Control**: Restrict access to management interfaces
5. **Regular Updates**: Keep images and dependencies updated

## Production Deployment

For production deployment:

1. Review and update all configurations
2. Enable TLS/SSL for all services
3. Configure proper backup strategies
4. Set up monitoring alerts
5. Test failover procedures
6. Document runbooks

## Support

For issues or questions:
- Check documentation
- Review troubleshooting guide
- Open GitHub issue
- Contact DevOps team

## License

MIT License - see LICENSE file for details
