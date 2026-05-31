# CStore Kubernetes Quick Start Guide

## Prerequisites Checklist

- [ ] Kubernetes cluster (v1.24+) is running
- [ ] `kubectl` is installed and configured
- [ ] Nginx Ingress Controller is installed
- [ ] cert-manager is installed (for automatic TLS)
- [ ] Storage provisioner is available
- [ ] DNS records are configured

## One-Command Deploy

```bash
# From the k8s directory
./deploy.sh
```

This will deploy all components in the correct order and wait for them to be ready.

## Manual Deploy (if script doesn't work)

```bash
# From the k8s directory
kubectl apply -k base/
```

## Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n cstore

# Check services
kubectl get svc -n cstore

# Check ingress
kubectl get ingress -n cstore
```

## Access Services

### Grafana Dashboard (Local Access)

```bash
kubectl port-forward -n cstore svc/grafana-service 3001:3001
```

Then open: http://localhost:3001
- Username: `admin`
- Password: `changeme-in-production`

### Prometheus (Local Access)

```bash
kubectl port-forward -n cstore svc/prometheus-service 9090:9090
```

Then open: http://localhost:9090

### Application API (Local Access)

```bash
kubectl port-forward -n cstore svc/cstore-api-service 3000:3000
```

Then open: http://localhost:3000/api/health

## Production Setup

### 1. Update Secrets

```bash
# Edit the secrets file
kubectl edit secret cstore-secrets -n cstore
kubectl edit secret grafana-secret -n cstore
```

### 2. Configure DNS

Point these domains to your ingress controller:
- `api.cstore.example.com` → Main API
- `monitoring.cstore.example.com` → Grafana
- `cdn.cstore.example.com` → Static assets

### 3. Configure TLS

Ensure cert-manager is set up with Let's Encrypt:

```bash
# Example: Create Let's Encrypt issuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Monitoring

### View Grafana Dashboards

1. **CStore Application Metrics**: Request rates, response times, errors
2. **Redis Cache Metrics**: Hit rates, memory usage, evictions
3. **Performance Overview**: Latency distribution, percentiles

### Check Prometheus Targets

```bash
# Port-forward Prometheus
kubectl port-forward -n cstore svc/prometheus-service 9090:9090

# Open http://localhost:9090/targets
```

All targets should show "UP" status.

## Scaling

### Auto-scaling

HPA is pre-configured:
- Min: 3 replicas
- Max: 10 replicas
- CPU target: 70%

### Manual scaling

```bash
kubectl scale deployment cstore-api -n cstore --replicas=5
```

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl get pods -n cstore

# Check specific pod
kubectl describe pod <pod-name> -n cstore
kubectl logs <pod-name> -n cstore
```

### PVC issues

```bash
# Check PVCs
kubectl get pvc -n cstore

# Check storage class
kubectl get storageclass
```

### Network connectivity

```bash
# Test from a debug pod
kubectl run -it --rm debug --image=nicolaka/netshoot -n cstore -- /bin/bash

# Inside the pod:
curl http://cstore-api-service:3000/api/health
curl http://redis-service:6379
```

## Cleanup

```bash
# From the k8s directory
./undeploy.sh
```

This will remove all resources and optionally delete PVCs and the namespace.

## Resource Requirements

**Minimum for all components:**
- CPU: 8 cores
- Memory: 16GB RAM
- Storage: 50GB

**Per component limits:**
- API pods: 500m CPU, 512Mi RAM each
- MongoDB: 1 CPU, 2Gi RAM
- Redis: 500m CPU, 512Mi RAM
- Prometheus: 1 CPU, 2Gi RAM
- Grafana: 500m CPU, 512Mi RAM
- Nginx: 300m CPU, 256Mi RAM

## Next Steps

1. ✅ Deploy the application
2. ⏳ Configure production secrets
3. ⏳ Set up DNS and TLS
4. ⏳ Configure backup strategies
5. ⏳ Set up external monitoring/alerting
6. ⏳ Test disaster recovery procedures

## Support

For detailed documentation, see [README.md](README.md)
