# CStore Kubernetes Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          External Users                          │
└───────────────────────┬─────────────┬───────────────────────────┘
                        │             │
                        │             │
            ┌───────────▼────────┐    │
            │   Ingress Controller│    │
            │     (TLS/SSL)      │    │
            └───────────┬────────┘    │
                        │             │
        ┌───────────────┼─────────────┴──────────────┐
        │               │                             │
        │               │                             │
┌───────▼──────┐ ┌─────▼────────┐  ┌────────────────▼─────┐
│   API        │ │   Grafana    │  │   CDN/Static Assets  │
│ (3-10 pods)  │ │  (1 pod)     │  │   Nginx (2 pods)     │
└───────┬──────┘ └──────┬───────┘  └──────────────────────┘
        │               │
        │       ┌───────▼──────┐
        │       │  Prometheus  │
        │       │   (1 pod)    │
        │       └───────┬──────┘
        │               │
        │       ┌───────▼──────────┐
        │       │  Redis Exporter  │
        │       │     (1 pod)      │
        │       └──────────────────┘
        │
┌───────┴──────────────────┐
│                           │
│   ┌───────────┐  ┌──────▼────┐
│   │  MongoDB  │  │   Redis   │
│   │StatefulSet│  │ (1 pod)   │
│   │  (1 pod)  │  └───────────┘
│   └───────────┘
│
└─────────────────────────────┘
     Persistent Storage Layer
```

## Network Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS
                               │
┌──────────────────────────────┼─────────────────────────────────┐
│ Ingress Layer (nginx)        │                                  │
│                              │                                  │
│  ┌───────────────────────────┼────────────────────────────┐   │
│  │                           │                             │   │
│  │  api.cstore.example.com   │  cdn.cstore.example.com    │   │
│  │  monitoring.cstore...     │                             │   │
│  └───────────────────────────┼────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────────┐
│ Application Layer            │                                  │
│                              │                                  │
│  ┌─────────────────┐    ┌───┴──────────┐    ┌─────────────┐  │
│  │  cstore-api     │───→│   grafana    │←───│ prometheus  │  │
│  │  (ClusterIP)    │    │  (ClusterIP) │    │ (ClusterIP) │  │
│  └────────┬────────┘    └──────────────┘    └──────┬──────┘  │
│           │                                          │          │
│           │                                          │          │
└───────────┼──────────────────────────────────────────┼─────────┘
            │                                          │
┌───────────┼──────────────────────────────────────────┼─────────┐
│ Data Layer│                                          │          │
│           │                                          │          │
│  ┌────────▼────────┐                    ┌───────────▼───────┐ │
│  │     redis       │←───────────────────│  redis-exporter  │ │
│  │  (ClusterIP)    │                    │   (ClusterIP)    │ │
│  └─────────────────┘                    └──────────────────┘ │
│                                                                │
│  ┌─────────────────┐                                          │
│  │    mongodb      │                                          │
│  │  (StatefulSet)  │                                          │
│  └─────────────────┘                                          │
└────────────────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────┐
│ Storage Layer                                                    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ mongodb-pvc  │  │  redis-pvc   │  │ prometheus-  │         │
│  │   (10Gi)     │  │   (5Gi)      │  │   pvc(20Gi)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │ grafana-pvc  │  │ static-assets│                            │
│  │   (5Gi)      │  │  -pvc (10Gi) │                            │
│  └──────────────┘  └──────────────┘                            │
└──────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Ingress Layer

**Purpose**: External access point for all services

**Components**:
- API Ingress: `api.cstore.example.com`
- Grafana Ingress: `monitoring.cstore.example.com/grafana`
- CDN Ingress: `cdn.cstore.example.com`

**Features**:
- TLS termination with cert-manager
- Rate limiting
- CORS support for CDN
- Basic auth for Grafana

### 2. Application Layer

#### CStore API
- **Replicas**: 3-10 (HPA enabled)
- **Resources**: 200m-500m CPU, 256-512Mi RAM per pod
- **Health Checks**: Liveness and readiness probes on `/api/health`
- **Metrics**: Prometheus annotations for scraping on port 3000

#### Grafana
- **Replicas**: 1
- **Resources**: 100m-500m CPU, 256-512Mi RAM
- **Storage**: 5Gi persistent volume
- **Pre-configured Dashboards**: Application, Redis, Performance

#### Prometheus
- **Replicas**: 1
- **Resources**: 250m-1000m CPU, 512Mi-2Gi RAM
- **Storage**: 20Gi persistent volume with 30-day retention
- **Scrape Interval**: 15s
- **Service Discovery**: Kubernetes pod discovery

#### Redis Exporter
- **Replicas**: 1
- **Resources**: 50m-100m CPU, 64-128Mi RAM
- **Exports**: Redis metrics to Prometheus

#### Nginx CDN
- **Replicas**: 2
- **Resources**: 100m-300m CPU, 128-256Mi RAM
- **Features**: 
  - Gzip compression
  - CDN-friendly cache headers
  - CORS enabled
  - Immutable assets caching

### 3. Data Layer

#### MongoDB
- **Type**: StatefulSet
- **Replicas**: 1
- **Resources**: 500m-1000m CPU, 512Mi-2Gi RAM
- **Storage**: 10Gi data + 1Gi config
- **Features**: Persistent storage, health checks

#### Redis
- **Type**: Deployment
- **Replicas**: 1
- **Resources**: 100m-500m CPU, 256-512Mi RAM
- **Storage**: 5Gi persistent volume
- **Configuration**:
  - AOF persistence enabled
  - Max memory: 512MB
  - Eviction policy: allkeys-lru

### 4. Storage Layer

**Persistent Volume Claims**:
- MongoDB Data: 10Gi (ReadWriteOnce)
- MongoDB Config: 1Gi (ReadWriteOnce)
- Redis Data: 5Gi (ReadWriteOnce)
- Prometheus Data: 20Gi (ReadWriteOnce)
- Grafana Data: 5Gi (ReadWriteOnce)
- Static Assets: 10Gi (ReadWriteMany)

**Total Storage**: 51Gi

## Security Architecture

### Network Policies

Each component has strict network policies:

1. **API Pods**:
   - Ingress: From ingress controller
   - Egress: To MongoDB, Redis, DNS, HTTPS

2. **MongoDB Pods**:
   - Ingress: From API pods only
   - Egress: DNS only

3. **Redis Pods**:
   - Ingress: From API pods and Redis exporter
   - Egress: DNS only

4. **Grafana Pods**:
   - Ingress: From ingress controller
   - Egress: To Prometheus, DNS

5. **Prometheus Pods**:
   - Ingress: From Grafana
   - Egress: To all monitoring targets, DNS

6. **Nginx CDN Pods**:
   - Ingress: From ingress controller
   - Egress: DNS only

### RBAC

**Prometheus Service Account**:
- ClusterRole: Read nodes, services, endpoints, pods, ingresses
- Permissions: Get, list, watch only (no write permissions)

### Pod Security

All pods implement:
- Non-root user execution
- Read-only root filesystem (where possible)
- Dropped capabilities (ALL)
- No privilege escalation
- Resource limits enforced

## Monitoring Flow

```
┌──────────────┐
│ Application  │
│    Pods      │ ──────► Expose /metrics endpoint
└──────────────┘
                                │
                                │
┌──────────────┐                │
│    Redis     │                │
└──────────────┘                │
        │                       │
        │                       │
        ▼                       │
┌──────────────┐                │
│Redis Exporter│                │
│ Expose :9121 │ ───────────────┘
└──────────────┘                │
                                │
                                │
                                ▼
                        ┌──────────────┐
                        │  Prometheus  │
                        │ Scrapes every│
                        │    15 sec    │
                        └──────┬───────┘
                               │
                               │ PromQL queries
                               │
                               ▼
                        ┌──────────────┐
                        │   Grafana    │
                        │  Dashboards  │
                        └──────────────┘
```

## Scaling Strategy

### Horizontal Scaling (HPA)

**Metrics-based**:
- CPU > 70% → Scale up
- Memory > 80% → Scale up
- Scale down after 5 minutes stabilization
- Scale up after 1 minute

**Behavior**:
- Scale up: 100% or 2 pods per 30s (max)
- Scale down: 50% per 60s

### Vertical Scaling

Components sized for medium traffic:
- Can increase resource limits for higher load
- Monitor actual usage in Grafana

## Data Flow

### Write Request Flow

```
User → Ingress → API Pod → MongoDB (write)
                        └─→ Redis (cache invalidation)
```

### Read Request Flow

```
User → Ingress → API Pod → Redis (check cache)
                        │
                        ├─→ Cache hit → Return
                        │
                        └─→ Cache miss → MongoDB → Update cache → Return
```

### Static Asset Flow

```
User → Ingress → Nginx CDN → Static Assets PVC
  ↑
  │
CDN Edge Cache (if configured)
```

## Deployment Strategy

1. **Data Layer First**: MongoDB, Redis
2. **Monitoring Stack**: Prometheus, Redis Exporter
3. **Visualization**: Grafana
4. **CDN Layer**: Nginx
5. **Application Layer**: API with HPA

**Rolling Updates**:
- Max unavailable: 25%
- Max surge: 25%
- Grace period: 30s

## Disaster Recovery

### Backup Points
- MongoDB: StatefulSet volumes (daily backups recommended)
- Redis: AOF persistence
- Prometheus: 30-day retention on PVC
- Grafana: Dashboard configs in ConfigMap

### Recovery Procedures
1. PVC snapshots for data layer
2. ConfigMap backups for configurations
3. Secret backups (encrypted)
4. Namespace export for quick recovery

## Performance Characteristics

**Expected Performance**:
- API Response Time: < 200ms (p95)
- Redis Cache Hit Rate: > 80%
- CPU Usage: 30-60% average
- Memory Usage: 40-70% average

**Scaling Thresholds**:
- Scale at 70% CPU
- Scale at 80% Memory
- Max 10 replicas for cost control
