# Production Deployment Checklist

Use this checklist to ensure your CStore Kubernetes deployment is production-ready.

## Pre-Deployment

### Infrastructure

- [ ] Kubernetes cluster is running (v1.24+)
- [ ] Cluster has sufficient resources (8+ cores, 16GB+ RAM)
- [ ] Storage provisioner is configured and tested
- [ ] Ingress controller (nginx) is installed
- [ ] cert-manager is installed for TLS certificates
- [ ] Monitoring infrastructure is planned
- [ ] Backup solution is available
- [ ] DNS is configured and ready

### Configuration

- [ ] Domain names are registered
- [ ] DNS records are ready to be updated
- [ ] TLS certificates strategy is decided (Let's Encrypt vs custom)
- [ ] Email for cert-manager notifications is configured
- [ ] Backup schedule is defined

## Secrets Management

### Update Default Secrets

- [ ] Update Grafana admin password in `grafana-secret.yaml`
- [ ] Update MongoDB root password in `secret.yaml`
- [ ] Update JWT secret in `secret.yaml`
- [ ] Update any API keys in `secret.yaml`
- [ ] Update session secrets in `secret.yaml`
- [ ] Review all secrets for production-grade values

### Apply Secrets

```bash
# Apply secrets before other resources
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/secret.yaml
kubectl apply -f k8s/base/grafana-secret.yaml
```

## Configuration Updates

### Update ConfigMap

- [ ] Review and update `NODE_ENV` (should be "production")
- [ ] Set correct `LOG_LEVEL` for production
- [ ] Update `REDIS_HOST` if using external Redis
- [ ] Update `CDN_URL` with actual domain
- [ ] Review all environment variables

### Update Ingress

Edit `k8s/base/ingress.yaml`:
- [ ] Replace `api.cstore.example.com` with actual API domain
- [ ] Replace `monitoring.cstore.example.com` with actual monitoring domain
- [ ] Replace `cdn.cstore.example.com` with actual CDN domain
- [ ] Verify cert-manager annotations
- [ ] Review rate limiting values

## Resource Planning

### Storage

- [ ] Verify storage class is available: `kubectl get storageclass`
- [ ] Ensure sufficient storage quota
- [ ] Plan for storage growth

**Required Storage**:
- MongoDB: 10Gi (data) + 1Gi (config) = 11Gi
- Redis: 5Gi
- Prometheus: 20Gi
- Grafana: 5Gi
- Static Assets: 10Gi
- **Total**: ~51Gi

### Compute Resources

- [ ] Cluster has sufficient CPU: 8+ cores
- [ ] Cluster has sufficient memory: 16GB+ RAM
- [ ] Node affinity rules are considered (if needed)

## Deployment

### Step 1: Deploy Core Infrastructure

```bash
# Deploy namespace and RBAC
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/prometheus-rbac.yaml

# Deploy secrets and config
kubectl apply -f k8s/base/secret.yaml
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/grafana-secret.yaml
```

- [ ] Namespace created successfully
- [ ] Secrets applied
- [ ] ConfigMaps applied

### Step 2: Deploy Data Layer

```bash
kubectl apply -f k8s/base/mongodb-statefulset.yaml
kubectl apply -f k8s/base/redis-deployment.yaml
```

- [ ] MongoDB StatefulSet is running
- [ ] MongoDB PVCs are bound
- [ ] Redis deployment is running
- [ ] Redis PVC is bound

### Step 3: Deploy Monitoring Stack

```bash
kubectl apply -f k8s/base/prometheus-configmap.yaml
kubectl apply -f k8s/base/prometheus-deployment.yaml
kubectl apply -f k8s/base/redis-exporter.yaml
kubectl apply -f k8s/base/grafana-configmap.yaml
kubectl apply -f k8s/base/grafana-deployment.yaml
```

- [ ] Prometheus is running
- [ ] Prometheus PVC is bound
- [ ] Redis exporter is running
- [ ] Grafana is running
- [ ] Grafana PVC is bound

### Step 4: Deploy Application Layer

```bash
kubectl apply -f k8s/base/api-deployment.yaml
```

- [ ] API deployment is running
- [ ] HPA is created
- [ ] All pods are healthy

### Step 5: Deploy CDN Layer

```bash
kubectl apply -f k8s/base/nginx-configmap.yaml
kubectl apply -f k8s/base/nginx-deployment.yaml
```

- [ ] Nginx pods are running
- [ ] Static assets PVC is bound

### Step 6: Configure Networking

```bash
kubectl apply -f k8s/base/network-policies.yaml
kubectl apply -f k8s/base/ingress.yaml
```

- [ ] Network policies are applied
- [ ] Ingress resources are created
- [ ] TLS certificates are issued (check with `kubectl get certificate -n cstore`)

## Post-Deployment Verification

### Health Checks

```bash
# Check all pods
kubectl get pods -n cstore

# All pods should be Running
```

- [ ] All pods in `Running` state
- [ ] No pods in `CrashLoopBackOff`
- [ ] No pods in `Error` state

### Service Verification

```bash
# Check services
kubectl get svc -n cstore
```

- [ ] All services have ClusterIP assigned
- [ ] All services show correct ports

### Storage Verification

```bash
# Check PVCs
kubectl get pvc -n cstore
```

- [ ] All PVCs are in `Bound` state
- [ ] All PVCs have storage allocated

### Ingress Verification

```bash
# Check ingress
kubectl get ingress -n cstore
```

- [ ] Ingress has ADDRESS assigned
- [ ] TLS secrets are created

### DNS Verification

- [ ] `api.cstore.example.com` resolves to ingress IP
- [ ] `monitoring.cstore.example.com` resolves to ingress IP
- [ ] `cdn.cstore.example.com` resolves to ingress IP

### Application Testing

```bash
# Test API health endpoint
curl https://api.cstore.example.com/api/health

# Expected: {"status":"ok"}
```

- [ ] API health endpoint returns 200
- [ ] API health endpoint returns correct JSON
- [ ] Can access main API endpoints

### Monitoring Verification

```bash
# Port-forward to Grafana
kubectl port-forward -n cstore svc/grafana-service 3001:3001
```

Then visit http://localhost:3001:
- [ ] Can login to Grafana
- [ ] Prometheus datasource is connected
- [ ] All three dashboards are loaded
- [ ] Dashboards show metrics

### Prometheus Verification

```bash
# Port-forward to Prometheus
kubectl port-forward -n cstore svc/prometheus-service 9090:9090
```

Then visit http://localhost:9090/targets:
- [ ] All scrape targets are UP
- [ ] `cstore-api` targets are discovered
- [ ] `redis` target is UP
- [ ] `prometheus` self-monitoring is UP

## Security Hardening

### Network Security

- [ ] Network policies are enabled
- [ ] Test that unauthorized pods cannot access MongoDB
- [ ] Test that unauthorized pods cannot access Redis
- [ ] Verify ingress controller is the only external access point

### Pod Security

```bash
# Verify pods run as non-root
kubectl get pods -n cstore -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext.runAsNonRoot}{"\n"}{end}'
```

- [ ] All pods run as non-root
- [ ] Security contexts are properly configured
- [ ] Read-only root filesystem where applicable

### RBAC

```bash
# Verify Prometheus service account
kubectl get serviceaccount prometheus -n cstore
kubectl get clusterrolebinding prometheus
```

- [ ] Prometheus service account exists
- [ ] ClusterRole bindings are correct
- [ ] Permissions are minimal (only read access)

### Secrets

```bash
# Verify secrets are not logged
kubectl logs -n cstore -l app=cstore-api | grep -i password
# Should return nothing
```

- [ ] Secrets are not exposed in logs
- [ ] Secrets are not in environment variables (use secretRef instead)
- [ ] All default passwords have been changed

## Monitoring Setup

### Configure Grafana

- [ ] Login to Grafana
- [ ] Change default admin password
- [ ] Verify Prometheus datasource
- [ ] Test all three dashboards:
  - [ ] CStore Application Metrics
  - [ ] Redis Cache Metrics
  - [ ] Performance Overview
- [ ] Configure email notifications (optional)
- [ ] Create additional users if needed

### Configure Alerts (Optional)

- [ ] Set up AlertManager (if using)
- [ ] Configure alert rules
- [ ] Test alert delivery
- [ ] Document alert response procedures

## Performance Testing

### Load Testing

- [ ] Run load tests against API
- [ ] Verify HPA scales up correctly
- [ ] Verify HPA scales down correctly
- [ ] Check resource usage during load

### Cache Testing

- [ ] Verify Redis cache is being used
- [ ] Check cache hit rate in Grafana
- [ ] Test cache invalidation

### Database Testing

- [ ] Verify MongoDB connection pooling
- [ ] Test database read/write performance
- [ ] Verify data persistence after pod restart

## Backup & Recovery

### Backup Configuration

- [ ] Set up automated MongoDB backups
- [ ] Set up automated PVC snapshots
- [ ] Document backup retention policy
- [ ] Test backup restoration process

### Disaster Recovery

- [ ] Document DR procedures
- [ ] Test MongoDB restore
- [ ] Test full stack recovery
- [ ] Verify RTO/RPO requirements

## Documentation

- [ ] Document custom configuration changes
- [ ] Document operational procedures
- [ ] Document troubleshooting steps
- [ ] Create runbooks for common operations
- [ ] Document rollback procedures

## Maintenance Plan

- [ ] Schedule regular backup testing
- [ ] Plan for certificate renewal (automatic with cert-manager)
- [ ] Schedule regular security updates
- [ ] Plan for Kubernetes version upgrades
- [ ] Document maintenance windows

## Final Verification

### Pre-Production Checklist

- [ ] All items above are completed
- [ ] All tests pass
- [ ] Team is trained on operations
- [ ] Documentation is complete
- [ ] On-call procedures are defined
- [ ] Rollback plan is documented

### Production Ready Sign-Off

- [ ] Development team sign-off
- [ ] Operations team sign-off
- [ ] Security team sign-off (if applicable)
- [ ] Management sign-off

## Post-Production

### Monitoring

- [ ] Set up external uptime monitoring
- [ ] Configure log aggregation
- [ ] Set up cost monitoring
- [ ] Review metrics daily for first week

### Optimization

- [ ] Monitor resource usage
- [ ] Adjust resource limits if needed
- [ ] Tune HPA thresholds based on actual load
- [ ] Optimize database queries if needed

### Continuous Improvement

- [ ] Review incident reports
- [ ] Update runbooks based on lessons learned
- [ ] Refine monitoring and alerts
- [ ] Plan for future scaling needs

---

## Quick Commands

### Check Deployment Status
```bash
kubectl get all -n cstore
```

### Check Pod Logs
```bash
kubectl logs -n cstore -l app=cstore-api --tail=100 -f
```

### Check Resource Usage
```bash
kubectl top pods -n cstore
kubectl top nodes
```

### Restart Deployment
```bash
kubectl rollout restart deployment/cstore-api -n cstore
```

### Scale Deployment
```bash
kubectl scale deployment/cstore-api -n cstore --replicas=5
```

### Update ConfigMap
```bash
kubectl edit configmap cstore-config -n cstore
# Then restart pods to pick up changes
kubectl rollout restart deployment/cstore-api -n cstore
```

---

**Last Updated**: Initial version
**Review Date**: Schedule for 30 days after deployment
