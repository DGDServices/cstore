# CI/CD Pipeline Documentation

## Overview

This document describes the comprehensive CI/CD pipeline implementation for the CStore cryptocurrency marketplace. The pipeline automates testing, building, security scanning, and deployment across multiple environments.

## Table of Contents

1. [Architecture](#architecture)
2. [Workflows](#workflows)
3. [Environments](#environments)
4. [Deployment Strategies](#deployment-strategies)
5. [Security](#security)
6. [Performance Testing](#performance-testing)
7. [Monitoring & Notifications](#monitoring--notifications)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)

## Architecture

The CI/CD pipeline consists of three main workflows:

- **CI Pipeline** (`ci.yml`) - Automated testing, linting, and security scanning
- **Deployment Pipeline** (`deploy.yml`) - Multi-environment deployments with blue-green strategy
- **Performance Testing** (`performance.yml`) - Load testing and benchmarking

### Pipeline Flow

```
┌─────────────────┐
│   Code Push     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Lint & Format  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Security Scan   │◄──── GitLeaks, npm audit
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Run Tests      │◄──── Jest, Coverage
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Docker    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Container Scan  │◄──── Trivy
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Deploy       │
└─────────────────┘
```

## Workflows

### 1. CI Pipeline (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**

1. **Lint & Format Check**
   - ESLint code quality checks
   - Prettier formatting validation
   - Node.js 20.x

2. **Security Scan**
   - npm audit for dependency vulnerabilities
   - GitLeaks for secrets detection
   - Results uploaded to GitHub Security tab

3. **Test** (Matrix: Node 18.x, 20.x)
   - Run Jest test suite with coverage
   - Upload coverage to Codecov
   - Archive test results

4. **Build Docker Images**
   - Build development image
   - Build production image
   - Multi-stage builds for optimization
   - GitHub Actions cache for faster builds

5. **Container Security Scan**
   - Trivy vulnerability scanning
   - SARIF output for GitHub Security
   - Severity: CRITICAL and HIGH

6. **CI Success**
   - Overall pipeline status check
   - Gates deployment workflow

### 2. Deployment Pipeline (`.github/workflows/deploy.yml`)

Handles deployments to development, staging, and production environments.

**Triggers:**
- Push to `develop` → Development
- Push to `main` → Staging
- Tag `v*` → Production
- Manual dispatch with environment selection

**Jobs:**

1. **Setup Deployment**
   - Determines target environment
   - Sets deployment flags

2. **Build & Push Docker Image**
   - Builds production Docker image
   - Pushes to GitHub Container Registry (ghcr.io)
   - Tags with environment and version

3. **Deploy to Development**
   - Automatic deployment from develop branch
   - Fast iteration, no blue-green
   - Basic health checks

4. **Deploy to Staging**
   - Blue-green deployment strategy
   - Comprehensive smoke tests
   - Traffic switching after validation

5. **Deploy to Production**
   - Blue-green deployment with gradual traffic shift
   - Database migrations
   - Maintenance mode support
   - Multi-stage traffic shift (10% → 50% → 100%)
   - Automatic rollback on failure
   - Post-deployment verification

6. **Notify Deployment Status**
   - Slack/Discord notifications (configurable)
   - Email notifications
   - GitHub commit status

### 3. Performance Testing (`.github/workflows/performance.yml`)

Runs on schedule or manual trigger.

**Jobs:**

1. **Load Testing**
   - K6 load tests
   - Configurable duration and environment
   - Results uploaded as artifacts
   - PR comments with metrics

2. **Stress Testing**
   - Determines system breaking point
   - Gradual load increase
   - Resource utilization monitoring

3. **API Benchmarking**
   - Baseline performance comparison
   - Regression detection

## Environments

### Development
- **URL:** `https://dev.cstore.example.com`
- **Trigger:** Push to `develop` branch
- **Purpose:** Feature testing and integration
- **Configuration:** `.env.development`

### Staging
- **URL:** `https://staging.cstore.example.com`
- **Trigger:** Push to `main` branch
- **Purpose:** Pre-production validation
- **Configuration:** `.env.staging`
- **Strategy:** Blue-green deployment

### Production
- **URL:** `https://cstore.example.com`
- **Trigger:** Git tag `v*` (e.g., `v1.0.0`)
- **Purpose:** Live production environment
- **Configuration:** `.env.production`
- **Strategy:** Blue-green with gradual traffic shift

## Deployment Strategies

### Blue-Green Deployment

Used for staging and production environments to enable zero-downtime deployments.

**Process:**

1. **Deploy to Blue Environment**
   - New version deployed to idle blue environment
   - No user traffic affected

2. **Health Checks**
   - Comprehensive health validation
   - Database connectivity
   - API endpoint testing

3. **Smoke Tests**
   - Functional testing of critical paths
   - Integration verification

4. **Traffic Shift** (Production only)
   - 10% traffic → Monitor for 2 minutes
   - 50% traffic → Monitor for 2 minutes
   - 100% traffic → Complete switch

5. **Monitoring**
   - Error rate monitoring
   - Performance metrics
   - Automatic rollback if thresholds exceeded

6. **Rollback Capability**
   - Instant rollback to green environment
   - Previous version remains available

### Rollback Process

Use the rollback script:

```bash
./scripts/deployment/rollback.sh <environment> [version]
```

Or manual rollback:

```bash
# Switch traffic back to green
kubectl patch service cstore-production -p '{"spec":{"selector":{"version":"green"}}}'

# Rollback Kubernetes deployment
kubectl rollout undo deployment/cstore-production
```

## Security

### Implemented Security Checks

1. **GitLeaks**
   - Scans for hardcoded secrets
   - Runs on every push
   - Prevents credential leaks

2. **npm audit**
   - Dependency vulnerability scanning
   - Moderate severity threshold
   - Automated fix suggestions

3. **Trivy Container Scanning**
   - Scans Docker images for vulnerabilities
   - OS package vulnerabilities
   - Application dependencies
   - CRITICAL and HIGH severity focus

4. **SARIF Integration**
   - Security findings in GitHub Security tab
   - Centralized vulnerability tracking

### Secrets Management

All sensitive configuration uses GitHub Secrets:

**Required Secrets:**

- `GITHUB_TOKEN` (automatically provided)
- `MONGODB_URI_STAGING`
- `MONGODB_URI_PRODUCTION`
- `JWT_SECRET_STAGING`
- `JWT_SECRET_PRODUCTION`
- `JWT_REFRESH_SECRET_STAGING`
- `JWT_REFRESH_SECRET_PRODUCTION`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- `ADMIN_EMAIL`
- `BLOCKCHAIN_API_KEY`
- `WEBHOOK_SECRET`
- `SENTRY_DSN` (optional)

**Optional Secrets:**

- `SLACK_WEBHOOK_URL` - For Slack notifications
- `DISCORD_WEBHOOK_URL` - For Discord notifications

## Performance Testing

### K6 Load Tests

Located in `tests/performance/load-test.js`

**Configuration:**
- Ramp up to 100 concurrent users
- 5-minute sustained load
- Tests health, products, and order endpoints

**Thresholds:**
- 95th percentile response time < 500ms
- Error rate < 10%

**Usage:**

```bash
# Local testing
k6 run tests/performance/load-test.js

# With custom environment
k6 run tests/performance/load-test.js --env BASE_URL=https://staging.cstore.example.com
```

### Stress Tests

Located in `tests/performance/stress-test.js`

**Purpose:**
- Find system breaking point
- Determine maximum capacity
- Test failure modes

**Configuration:**
- Gradual increase to 400+ users
- Extended duration (20 minutes)
- Monitors until failure or completion

## Monitoring & Notifications

### Build Status

- GitHub commit status checks
- PR status updates
- Branch protection rules

### Notifications

Configure webhooks for:

1. **Slack Integration**
   ```yaml
   - name: Send Slack notification
     uses: slackapi/slack-github-action@v1
     with:
       payload: |
         {
           "text": "Deployment Status: ${{ job.status }}"
         }
     env:
       SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
   ```

2. **Discord Integration**
   ```yaml
   - name: Send Discord notification
     uses: Ilshidur/action-discord@master
     with:
       args: 'Deployment to {{ EVENT_ENV }} completed'
     env:
       DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK_URL }}
   ```

### Metrics

- Test coverage trends
- Deployment frequency
- Mean time to recovery (MTTR)
- Change failure rate

## Configuration

### Environment Variables

Each environment has its configuration file:

- `config/environments/.env.development`
- `config/environments/.env.staging`
- `config/environments/.env.production`

**Never commit real secrets to version control!**

### Deployment Scripts

Located in `scripts/deployment/`:

1. **health-check.sh**
   - Validates application health
   - Checks database connectivity
   - Configurable timeout and retries

2. **smoke-test.sh**
   - Basic functional tests
   - Critical endpoint validation
   - Quick deployment verification

3. **rollback.sh**
   - Automated rollback process
   - Blue-green traffic switching
   - Deployment history restoration

## Troubleshooting

### Common Issues

**1. Tests Failing in CI but Passing Locally**

- Check Node.js version compatibility
- Verify environment variables are set
- Review test database connectivity

**2. Docker Build Failures**

- Clear GitHub Actions cache: Re-run workflow
- Check Dockerfile syntax
- Verify base image availability

**3. Deployment Failures**

- Check health check logs
- Verify secrets are configured
- Review deployment logs
- Check resource availability (CPU, memory)

**4. Rollback Not Working**

- Verify previous version is available
- Check Kubernetes deployment history
- Ensure traffic switch commands have permissions

### Debug Commands

```bash
# Check deployment status
kubectl get deployments
kubectl get pods
kubectl describe pod <pod-name>

# View logs
kubectl logs -f deployment/cstore-production

# Check service routing
kubectl get service cstore-production -o yaml

# View deployment history
kubectl rollout history deployment/cstore-production
```

### Support

For issues or questions:

1. Check GitHub Actions logs
2. Review this documentation
3. Contact DevOps team
4. Create GitHub issue

## Best Practices

1. **Always run tests locally before pushing**
2. **Use feature branches and pull requests**
3. **Review security scan results**
4. **Monitor deployments actively**
5. **Test rollback procedures regularly**
6. **Keep dependencies updated**
7. **Document configuration changes**
8. **Use semantic versioning for releases**

## Continuous Improvement

The CI/CD pipeline is continuously evolving. Suggested enhancements:

- [ ] Add chaos engineering tests
- [ ] Implement canary deployments
- [ ] Add automated performance regression tests
- [ ] Enhance monitoring with Prometheus/Grafana
- [ ] Add automated dependency updates (Dependabot)
- [ ] Implement feature flags
- [ ] Add A/B testing capabilities

---

**Last Updated:** 2024
**Version:** 1.0
**Maintained By:** DevOps Team
