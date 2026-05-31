# Deployment Guide

**Production deployment and infrastructure guidelines for Cryptons.com**

⚠️ **CRITICAL WARNING**: This platform is NOT production-ready for real cryptocurrency transactions. See [README.md](README.md#-critical-production-warning) for complete requirements.

---

## 📋 Table of Contents

- [Deployment Options](#-deployment-options)
- [Prerequisites](#-prerequisites)
- [Environment Configuration](#-environment-configuration)
- [Docker Deployment](#-docker-deployment)
- [Kubernetes Deployment](#-kubernetes-deployment)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Monitoring & Logging](#-monitoring--logging)
- [Security Considerations](#-security-considerations)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Deployment Options

### Development Environment
- **Purpose**: Local development and testing
- **Setup Time**: 5 minutes
- **Method**: Node.js + MongoDB locally
- **Guide**: [GETTING_STARTED.md](GETTING_STARTED.md)

### Staging Environment
- **Purpose**: Pre-production testing
- **Setup Time**: 30 minutes
- **Method**: Docker Compose or Kubernetes
- **Auto-deploy**: From `main` branch via CI/CD

### Production Environment
- **Purpose**: Live platform (when ready)
- **Setup Time**: Multiple days
- **Method**: Kubernetes with HA setup
- **Deploy**: Manual approval with version tags

---

## ✅ Prerequisites

### Infrastructure Requirements

**Minimum Specs:**
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: Static IP with HTTPS support

**Recommended for Production:**
- **CPU**: 8+ cores
- **RAM**: 16GB+
- **Storage**: 100GB+ SSD with backups
- **Network**: Load balancer, CDN, DDoS protection

### Required Services

1. **MongoDB 4.4+**
   - Replica set recommended for production
   - Automated backups configured
   - Encryption at rest enabled

2. **Redis** (for caching and sessions)
   - Persistent storage configured
   - HA setup recommended

3. **Node.js 18+**
   - LTS version recommended (Node.js 20 used in Docker)
   - PM2 or similar process manager

### Optional Services

4. **Elasticsearch** (for advanced search)
5. **SMTP Server** (for email notifications)
6. **Prometheus + Grafana** (for monitoring)

---

## ⚙️ Environment Configuration

### Environment Variables

Create appropriate `.env` file for each environment:

#### Development (.env.development)
```env
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
MONGODB_URI=mongodb://localhost:27017/cryptons_dev

# JWT
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRE=24h

# Redis
REDIS_URL=redis://localhost:6379

# Email (optional for dev)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=dev@example.com
SMTP_PASS=dev-password
```

#### Production (.env.production)
```env
# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database (use connection string with auth)
MONGODB_URI=mongodb://username:password@mongo-cluster:27017/cryptons?replicaSet=rs0&authSource=admin

# JWT (MUST use strong secret)
JWT_SECRET=<strong-random-secret-256-bits>
JWT_EXPIRE=24h

# Redis
REDIS_URL=redis://:password@redis-cluster:6379

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>

# Security
CORS_ORIGIN=https://yourdomain.com
HELMET_ENABLED=true
RATE_LIMIT_ENABLED=true

# Monitoring
SENTRY_DSN=<your-sentry-dsn>

# Elasticsearch (optional)
ELASTICSEARCH_NODE=http://elasticsearch:9200
```

### Configuration Management

**Recommended Approaches:**

1. **Kubernetes Secrets** (for K8s deployments)
```bash
kubectl create secret generic cryptons-secrets \
  --from-literal=mongodb-uri="mongodb://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=redis-url="..."
```

2. **HashiCorp Vault** (enterprise)
3. **AWS Secrets Manager** (AWS deployments)
4. **Azure Key Vault** (Azure deployments)

---

## 🐳 Docker Deployment

### Docker Compose (Simple Deployment)

**Use Case**: Development, small deployments, staging

#### 1. Build and Start Services

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Check status
docker-compose ps
```

#### 2. Environment Configuration

Edit `docker-compose.yml` or create `.env` file:

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/cryptons
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped

  mongodb:
    image: mongo:5
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  mongo-data:
  redis-data:
```

#### 3. Health Checks

```bash
# Check API health
curl http://localhost:3000/api/health

# Check specific services
docker-compose exec api npm run health-check
```

#### 4. Maintenance

```bash
# View logs
docker-compose logs -f

# Restart service
docker-compose restart api

# Update and restart
docker-compose pull
docker-compose up -d

# Backup database
docker-compose exec mongodb mongodump --out=/backup

# Stop all services
docker-compose down
```

---

## ☸️ Kubernetes Deployment

**Use Case**: Production, scalable deployments, high availability

### Quick Start

#### 1. Apply Kubernetes Manifests

```bash
# Create namespace
kubectl create namespace cryptons

# Apply all manifests
kubectl apply -f k8s/ -n cryptons

# Check deployment status
kubectl get pods -n cryptons
kubectl get services -n cryptons
```

#### 2. Configure Secrets

```bash
# Create secrets from files
kubectl create secret generic cryptons-secrets \
  --from-env-file=.env.production \
  -n cryptons

# Or create from literals
kubectl create secret generic cryptons-secrets \
  --from-literal=mongodb-uri="mongodb://..." \
  --from-literal=jwt-secret="..." \
  -n cryptons
```

#### 3. Access the Application

```bash
# Get external IP (LoadBalancer)
kubectl get svc cryptons-api -n cryptons

# Or use port-forward for testing
kubectl port-forward svc/cryptons-api 3000:3000 -n cryptons
```

### Architecture Overview

```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────▼─────┐
    │  Ingress │
    └────┬─────┘
         │
    ┌────▼──────────────┐
    │  API Deployment   │
    │  (3 replicas)     │
    └────┬──────────────┘
         │
    ┌────▼────┬─────────┐
    │         │         │
┌───▼───┐ ┌──▼──┐ ┌────▼────┐
│MongoDB│ │Redis│ │Elastic  │
│Replica│ │ HA  │ │search   │
└───────┘ └─────┘ └─────────┘
```

### Kubernetes Resources

**Key Manifests** (in `k8s/` directory):

1. **Deployment** (`deployment.yaml`)
   - API deployment with 3 replicas
   - Rolling update strategy
   - Resource limits and requests
   - Health probes configured

2. **Service** (`service.yaml`)
   - LoadBalancer or ClusterIP
   - Port configuration
   - Service discovery

3. **Ingress** (`ingress.yaml`)
   - HTTPS termination
   - Domain routing
   - SSL certificate management

4. **ConfigMap** (`configmap.yaml`)
   - Non-sensitive configuration
   - Environment-specific settings

5. **Secrets** (`secrets.yaml`)
   - Sensitive credentials
   - Encrypted at rest

6. **HorizontalPodAutoscaler** (`hpa.yaml`)
   - Auto-scaling based on CPU/memory
   - Min: 3, Max: 10 replicas

### Scaling

```bash
# Manual scaling
kubectl scale deployment cryptons-api --replicas=5 -n cryptons

# Auto-scaling is configured via HPA
kubectl get hpa -n cryptons

# Check current resource usage
kubectl top pods -n cryptons
```

### Updates and Rollbacks

```bash
# Update deployment (rolling update)
kubectl set image deployment/cryptons-api \
  api=yourdockerhub/cryptons:v2.2.0 \
  -n cryptons

# Check rollout status
kubectl rollout status deployment/cryptons-api -n cryptons

# Rollback to previous version
kubectl rollout undo deployment/cryptons-api -n cryptons

# Rollback to specific revision
kubectl rollout undo deployment/cryptons-api --to-revision=2 -n cryptons
```

**Documentation:** [k8s/README.md](k8s/README.md)

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

The project includes comprehensive CI/CD automation:

#### 1. Continuous Integration (`.github/workflows/ci.yml`)

**Triggers**: Push, Pull Request, Schedule

**Jobs:**
- Linting (ESLint, Prettier)
- Testing (Jest with coverage)
- Security scanning (npm audit, GitLeaks, Trivy)
- Docker build and push

#### 2. Deployment Pipeline (`.github/workflows/deploy.yml`)

**Environments:**
- **Development**: Auto-deploy from `develop` branch
- **Staging**: Auto-deploy from `main` branch  
- **Production**: Manual approval with tags (e.g., `v2.2.0`)

**Features:**
- Blue-green deployment
- Automated health checks
- Smoke tests after deployment
- Automatic rollback on failure
- Slack/email notifications

#### 3. Performance Testing (`.github/workflows/performance.yml`)

**Triggers**: Weekly schedule, Manual, Release tags

**Tests:**
- Load testing (K6)
- Stress testing
- Performance benchmarking
- Regression detection

### Deployment Process

#### Development Deployment
```bash
# Push to develop branch
git push origin develop

# CI/CD automatically deploys to dev environment
```

#### Staging Deployment
```bash
# Merge to main branch
git checkout main
git merge develop
git push origin main

# CI/CD automatically deploys to staging
```

#### Production Deployment
```bash
# Create and push version tag
git tag -a v2.2.0 -m "Release version 2.2.0"
git push origin v2.2.0

# Requires manual approval in GitHub Actions
# Navigate to Actions tab → Select workflow → Approve deployment
```

### Deployment Scripts

Located in `scripts/deployment/`:

1. **health-check.sh** - Validates deployment health
2. **smoke-test.sh** - Tests critical endpoints
3. **rollback.sh** - Automated rollback on failure

**Usage:**
```bash
# Health check
./scripts/deployment/health-check.sh http://api-url

# Smoke tests
./scripts/deployment/smoke-test.sh http://api-url

# Rollback (if needed)
./scripts/deployment/rollback.sh production
```

**Documentation:** [docs/infrastructure/CICD_PIPELINE.md](docs/infrastructure/CICD_PIPELINE.md)

---

## 📊 Monitoring & Logging

### Health Checks

**Built-in Endpoints:**
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed system status

**Response Example:**
```json
{
  "status": "OK",
  "timestamp": "2025-10-14T07:39:49.253Z",
  "uptime": 86400,
  "database": "connected",
  "redis": "connected",
  "services": {
    "email": "configured",
    "elasticsearch": "connected"
  }
}
```

### Prometheus Metrics

**Exposed at**: `/metrics`

**Key Metrics:**
- HTTP request duration
- Response status codes
- Active connections
- Database query performance
- Memory and CPU usage

### Grafana Dashboards

Pre-configured dashboards available in `monitoring/grafana/`:

1. **Application Dashboard**
   - Request rate and latency
   - Error rates
   - API endpoint performance

2. **Infrastructure Dashboard**
   - CPU and memory usage
   - Network I/O
   - Disk usage

3. **Business Metrics Dashboard**
   - Order creation rate
   - Payment success rate
   - User registrations

### Logging

**Log Levels:**
- `error` - Production issues requiring immediate attention
- `warn` - Warning conditions
- `info` - Informational messages (default in production)
- `debug` - Detailed debug information (development only)

**Log Destinations:**
- Console output (captured by container orchestrator)
- File rotation (`logs/` directory)
- Centralized logging (ELK stack recommended)

**Configuration:**
```env
LOG_LEVEL=info
LOG_FILE=logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7
```

---

## 🔒 Security Considerations

### Pre-Deployment Security Checklist

- [ ] **Secrets Management**: No secrets in code or version control
- [ ] **HTTPS/TLS**: SSL certificates configured and valid
- [ ] **Firewall Rules**: Only necessary ports exposed
- [ ] **Database Security**: Authentication enabled, network isolation
- [ ] **Rate Limiting**: Configured to prevent abuse
- [ ] **CORS**: Properly configured allowed origins
- [ ] **Security Headers**: Helmet.js configured correctly
- [ ] **Input Validation**: All endpoints validated
- [ ] **Dependency Audit**: Run `npm audit` and fix issues

### Required Security Implementations

**CRITICAL** (must be implemented before production):

1. **JWT Token Revocation**
   - Guide: [docs/security/JWT_TOKEN_REVOCATION.md](docs/security/JWT_TOKEN_REVOCATION.md)
   - Requires: Redis for token blacklist

2. **Database Encryption at Rest**
   - Guide: [docs/security/DATABASE_ENCRYPTION.md](docs/security/DATABASE_ENCRYPTION.md)
   - Requires: MongoDB Enterprise or cloud encryption

3. **Webhook Security**
   - Guide: [docs/security/WEBHOOK_SECURITY.md](docs/security/WEBHOOK_SECURITY.md)
   - Requires: HMAC signature verification

4. **Secrets Management**
   - Guide: [docs/security/SECRETS_MANAGEMENT.md](docs/security/SECRETS_MANAGEMENT.md)
   - Requires: Vault, AWS Secrets Manager, or similar

### Network Security

**Recommended Configuration:**
```
Internet
    ↓
[CDN/WAF] ← DDoS protection, rate limiting
    ↓
[Load Balancer] ← SSL termination, health checks
    ↓
[API Servers] ← Application logic (private network)
    ↓
[Database/Cache] ← Data layer (private network, no internet access)
```

### Backup Strategy

**Required Backups:**
1. **Database**: Daily automated backups, 30-day retention
2. **Configuration**: Version controlled in Git
3. **Secrets**: Encrypted backup in secure location
4. **Logs**: 90-day retention for compliance

**Testing:**
- Restore testing: Monthly
- Disaster recovery drill: Quarterly

---

## 🐛 Troubleshooting

### Common Deployment Issues

#### Database Connection Fails

**Symptoms**: Application won't start, connection timeout errors

**Solutions:**
```bash
# Check MongoDB is running
docker-compose ps mongodb
kubectl get pods -l app=mongodb -n cryptons

# Verify connection string
echo $MONGODB_URI

# Test connection manually
mongo "mongodb://host:27017/cryptons"

# Check network connectivity
telnet mongodb-host 27017
```

#### Application Crashes on Startup

**Symptoms**: Pods/containers in CrashLoopBackOff

**Solutions:**
```bash
# Check logs
docker-compose logs api
kubectl logs -f deployment/cryptons-api -n cryptons

# Common issues:
# 1. Missing environment variables
# 2. Invalid MongoDB URI
# 3. Port already in use
# 4. Insufficient resources
```

#### High Memory Usage

**Symptoms**: Out of memory errors, pod evictions

**Solutions:**
```bash
# Check memory usage
docker stats
kubectl top pods -n cryptons

# Increase resource limits in K8s
# Edit deployment.yaml:
resources:
  limits:
    memory: "2Gi"
  requests:
    memory: "1Gi"
```

#### Slow API Responses

**Symptoms**: High latency, timeouts

**Solutions:**
```bash
# Check database performance
# Enable MongoDB slow query log

# Check Redis connectivity
redis-cli ping

# Review application logs for slow queries
grep "slow query" logs/app.log

# Scale up if needed
kubectl scale deployment cryptons-api --replicas=5 -n cryptons
```

### Health Check Failures

```bash
# Run health check
curl http://localhost:3000/api/health

# Check detailed health
curl http://localhost:3000/api/health/detailed

# Review specific service status
# Database, Redis, Elasticsearch connections
```

### Rolling Back Deployment

```bash
# Docker Compose
docker-compose down
git checkout previous-version
docker-compose up -d

# Kubernetes
kubectl rollout undo deployment/cryptons-api -n cryptons

# Or use automated rollback script
./scripts/deployment/rollback.sh production
```

---

## 📚 Additional Resources

### Documentation
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Development setup
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture
- **[FEATURES.md](FEATURES.md)** - Feature documentation
- **[CI/CD Pipeline](docs/infrastructure/CICD_PIPELINE.md)** - Complete CI/CD guide
- **[Kubernetes Guide](k8s/README.md)** - K8s deployment details
- **[Security Documentation](docs/security/README.md)** - Security implementation

### Tools and Scripts
- **Deployment Scripts**: `scripts/deployment/`
- **Kubernetes Manifests**: `k8s/`
- **Monitoring Config**: `monitoring/`
- **Docker Files**: `Dockerfile`, `docker-compose.yml`

### Support
- **Issues**: [GitHub Issues](https://github.com/thewriterben/cstore/issues)
- **Discussions**: [GitHub Discussions](https://github.com/thewriterben/cstore/discussions)

---

## ⚠️ Important Reminders

**Before Production Deployment:**
1. Complete all critical security implementations
2. Obtain necessary licenses and compliance approvals
3. Conduct professional security audit
4. Set up 24/7 monitoring and alerting
5. Establish incident response procedures
6. Test disaster recovery procedures
7. Review and update all documentation

**Estimated Timeline to Production**: 18-36 months from October 2025
**Estimated Cost**: $1.5-4M initial + $700K-2.5M annual

For complete production requirements, see [README.md](README.md#-production-readiness-checklist)

---

**Version:** 2.2.0  
**Last Updated:** April 2026  
**Status:** Development/Educational Platform

*This deployment guide is for educational and development purposes. Professional consultation required for production deployment.*
