# CStore Kubernetes Deployment

This directory contains production-ready Kubernetes manifests for deploying the CStore application with full monitoring, caching, and CDN integration.

## Architecture Overview

### Components

1. **Core Application Layer**
   - API Deployment with HPA (3-10 replicas)
   - Health checks and resource limits
   - Prometheus metrics integration

2. **Data Layer**
   - MongoDB StatefulSet with persistent storage
   - Redis cache with persistence and monitoring
   - Proper resource allocation and health checks

3. **Monitoring Stack**
   - Prometheus for metrics collection
   - Grafana with pre-configured dashboards
   - Redis Exporter for cache monitoring
   - Service discovery and RBAC configured

4. **CDN and Static Assets**
   - Nginx for static asset serving
   - CDN-friendly cache headers
   - Persistent volume for assets
   - CORS and compression enabled

5. **Security**
   - Network policies for pod-to-pod communication
   - RBAC for Prometheus service account
   - Security contexts with non-root users
   - Read-only root filesystems where applicable

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Nginx Ingress Controller
- cert-manager (for TLS certificates)
- Storage provisioner for PVCs
- kustomize (optional, for easier deployment)

## Quick Start

### Using Kustomize (Recommended)

```bash
# Deploy all resources
kubectl apply -k k8s/base/

# Verify deployment
kubectl get all -n cstore
```

### Manual Deployment

```bash
# Create namespace
kubectl apply -f k8s/base/namespace.yaml

# Deploy core application
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/secret.yaml
kubectl apply -f k8s/base/api-deployment.yaml

# Deploy data layer
kubectl apply -f k8s/base/mongodb-statefulset.yaml
kubectl apply -f k8s/base/redis-deployment.yaml

# Deploy monitoring stack
kubectl apply -f k8s/base/prometheus-rbac.yaml
kubectl apply -f k8s/base/prometheus-configmap.yaml
kubectl apply -f k8s/base/prometheus-deployment.yaml
kubectl apply -f k8s/base/redis-exporter.yaml
kubectl apply -f k8s/base/grafana-secret.yaml
kubectl apply -f k8s/base/grafana-configmap.yaml
kubectl apply -f k8s/base/grafana-deployment.yaml

# Deploy CDN and static assets
kubectl apply -f k8s/base/nginx-configmap.yaml
kubectl apply -f k8s/base/nginx-deployment.yaml

# Configure networking
kubectl apply -f k8s/base/ingress.yaml
kubectl apply -f k8s/base/network-policies.yaml
```

## Configuration

### Environment Variables

Update `configmap.yaml` with your configuration:
- `REDIS_HOST`: Redis service hostname
- `CDN_URL`: Your CDN domain
- `METRICS_ENABLED`: Enable/disable Prometheus metrics

Update `secret.yaml` with sensitive data:
- Database credentials
- API keys
- JWT secrets

### Ingress Domains

Update the following domains in `ingress.yaml`:
- `api.cstore.example.com` - Main API
- `monitoring.cstore.example.com` - Grafana dashboard
- `cdn.cstore.example.com` - Static assets CDN

### Grafana Credentials

Default credentials (change in production):
- Username: `admin`
- Password: `changeme-in-production`

Update in `grafana-secret.yaml`

## Monitoring

### Access Grafana

```bash
# Port forward to access locally
kubectl port-forward -n cstore svc/grafana-service 3001:3001

# Access at http://localhost:3001
```

### Pre-configured Dashboards

1. **CStore Application Metrics**
   - Request rate and response times
   - Error rates by endpoint
   - Resource usage (CPU/Memory)

2. **Redis Cache Metrics**
   - Cache hit/miss rates
   - Memory usage and eviction
   - Connected clients
   - Commands per second

3. **Performance Overview**
   - Request latency distribution
   - Response time percentiles (p50, p95, p99)
   - Throughput by status code
   - Overall error rate

### Access Prometheus

```bash
# Port forward to access locally
kubectl port-forward -n cstore svc/prometheus-service 9090:9090

# Access at http://localhost:9090
```

## Scaling

### Horizontal Pod Autoscaling

The API deployment includes HPA configuration:
- Min replicas: 3
- Max replicas: 10
- Target CPU: 70%
- Target Memory: 80%

### Manual Scaling

```bash
# Scale API pods
kubectl scale deployment cstore-api -n cstore --replicas=5

# Scale Nginx CDN
kubectl scale deployment nginx-cdn -n cstore --replicas=3
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n cstore
kubectl describe pod <pod-name> -n cstore
kubectl logs <pod-name> -n cstore
```

### Check Services

```bash
kubectl get svc -n cstore
kubectl get ingress -n cstore
```

### Check Persistent Volumes

```bash
kubectl get pvc -n cstore
kubectl get pv
```

### Network Policies

```bash
# List network policies
kubectl get networkpolicy -n cstore

# Test connectivity
kubectl run -it --rm debug --image=nicolaka/netshoot -n cstore -- /bin/bash
```

### Common Issues

1. **Pods stuck in Pending**: Check PVC provisioning and node resources
2. **ImagePullBackOff**: Verify image names and registry access
3. **CrashLoopBackOff**: Check logs for application errors
4. **Ingress not working**: Verify ingress controller and DNS configuration

## Resource Requirements

### Minimum Cluster Resources

- CPU: 8 cores
- Memory: 16GB
- Storage: 50GB

### Per Component

- API (per pod): 200m CPU, 256Mi memory
- MongoDB: 500m CPU, 512Mi memory
- Redis: 100m CPU, 256Mi memory
- Prometheus: 250m CPU, 512Mi memory
- Grafana: 100m CPU, 256Mi memory
- Nginx: 100m CPU, 128Mi memory

## Security Considerations

1. **Update Secrets**: Change all default passwords and secrets in production
2. **TLS Certificates**: Configure cert-manager for automatic certificate management
3. **Network Policies**: Enabled by default, review and adjust as needed
4. **RBAC**: Prometheus has minimal required permissions
5. **Pod Security**: All pods run as non-root with read-only root filesystems where possible

## Backup and Disaster Recovery

### MongoDB Backup

```bash
# Create manual backup
kubectl exec -n cstore mongodb-0 -- mongodump --out /backup

# Restore from backup
kubectl exec -n cstore mongodb-0 -- mongorestore /backup
```

### Redis Backup

Redis uses AOF persistence by default. Backups are stored in the persistent volume.

### Prometheus Data

Prometheus data is stored in persistent volume with 30-day retention.

## Updating the Application

### Rolling Update

```bash
# Update image version
kubectl set image deployment/cstore-api cstore=cstore:v2.0.0 -n cstore

# Or apply updated manifest
kubectl apply -f k8s/base/api-deployment.yaml
```

### Rollback

```bash
# View rollout history
kubectl rollout history deployment/cstore-api -n cstore

# Rollback to previous version
kubectl rollout undo deployment/cstore-api -n cstore
```

## Production Checklist

- [ ] Update all secrets and passwords
- [ ] Configure DNS records for ingress domains
- [ ] Set up TLS certificates
- [ ] Configure backup strategies
- [ ] Set up external monitoring/alerting
- [ ] Review and adjust resource limits
- [ ] Configure log aggregation
- [ ] Test disaster recovery procedures
- [ ] Document runbooks for common operations
- [ ] Set up CI/CD pipeline integration

## Support

For issues or questions, please refer to the main project documentation or create an issue in the repository.
