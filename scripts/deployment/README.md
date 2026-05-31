# Deployment Scripts

This directory contains deployment automation scripts for the Cryptons.com application.

## Scripts

### health-check.sh

Performs comprehensive health checks on deployed application instances.

**Usage:**
```bash
./health-check.sh <environment-url> [timeout] [max-retries]
```

**Examples:**
```bash
# Check localhost
./health-check.sh http://localhost:3000

# Check staging with custom timeout
./health-check.sh https://staging.cryptons.com 60 20

# Check production
./health-check.sh https://cryptons.com
```

**Features:**
- HTTP status code validation
- Database connectivity check
- Configurable timeout and retry logic
- Clear success/failure reporting

**Exit Codes:**
- `0` - Health check passed
- `1` - Health check failed

---

### smoke-test.sh

Runs basic functional tests to verify deployment success.

**Usage:**
```bash
./smoke-test.sh <environment-url>
```

**Examples:**
```bash
# Test localhost
./smoke-test.sh http://localhost:3000

# Test staging
./smoke-test.sh https://staging.cryptons.com

# Test production
./smoke-test.sh https://cryptons.com
```

**Tests:**
- Health endpoint functionality
- Products listing API
- Authentication protection
- 404 error handling
- API root accessibility

**Exit Codes:**
- `0` - All tests passed
- `1` - One or more tests failed

---

### rollback.sh

Automates the rollback process for failed deployments.

**Usage:**
```bash
./rollback.sh <environment> [previous-version]
```

**Examples:**
```bash
# Rollback staging to previous version
./rollback.sh staging

# Rollback production to specific version
./rollback.sh production 42

# Rollback development
./rollback.sh development
```

**Features:**
- Interactive confirmation
- Blue-green traffic switching
- Kubernetes deployment rollback
- Automated verification
- Safe rollback with validation

**Requirements:**
- kubectl configured and authenticated
- Proper RBAC permissions
- Blue-green deployment setup

**Exit Codes:**
- `0` - Rollback successful
- `1` - Rollback failed

---

## Prerequisites

All scripts require:

- Bash 4.0 or higher
- `curl` for HTTP requests
- Appropriate network access to target environments

Additional requirements for rollback.sh:

- `kubectl` CLI tool
- Kubernetes cluster access
- Configured authentication

## Integration with CI/CD

These scripts are used in GitHub Actions workflows:

- **health-check.sh** - Called after deployments in `deploy.yml`
- **smoke-test.sh** - Run in staging and production deployments
- **rollback.sh** - Referenced for manual rollback procedures

## Testing Scripts Locally

```bash
# Make scripts executable
chmod +x *.sh

# Test health check
./health-check.sh http://localhost:3000 30 5

# Test smoke tests
./smoke-test.sh http://localhost:3000

# Dry-run rollback (requires kubectl)
./rollback.sh staging
```

## Troubleshooting

### Health Check Times Out
- Increase timeout value
- Verify network connectivity
- Check application logs

### Smoke Tests Fail
- Review specific test failures
- Verify API endpoints are accessible
- Check authentication configuration

### Rollback Fails
- Verify kubectl access
- Check deployment history
- Ensure blue-green setup is correct

## Contributing

When adding new scripts:

1. Make scripts executable: `chmod +x script-name.sh`
2. Add comprehensive error handling
3. Use `set -e` for fail-fast behavior
4. Document usage and examples
5. Update this README

## Support

For issues with deployment scripts:

1. Check script output for error messages
2. Review CI/CD pipeline logs
3. Consult `docs/CICD_PIPELINE.md`
4. Contact DevOps team
