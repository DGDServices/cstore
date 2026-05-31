#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="cstore"
KUSTOMIZE_DIR="./base"

echo -e "${GREEN}CStore Kubernetes Deployment Script${NC}"
echo "======================================"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} kubectl is configured"

# Function to wait for deployment
wait_for_deployment() {
    local deployment=$1
    local namespace=$2
    echo -e "${YELLOW}Waiting for deployment/${deployment} to be ready...${NC}"
    kubectl wait --for=condition=available --timeout=300s deployment/${deployment} -n ${namespace} || {
        echo -e "${RED}✗ Deployment ${deployment} failed to become ready${NC}"
        return 1
    }
    echo -e "${GREEN}✓${NC} Deployment ${deployment} is ready"
}

# Function to wait for statefulset
wait_for_statefulset() {
    local statefulset=$1
    local namespace=$2
    echo -e "${YELLOW}Waiting for statefulset/${statefulset} to be ready...${NC}"
    kubectl wait --for=jsonpath='{.status.readyReplicas}'=1 --timeout=300s statefulset/${statefulset} -n ${namespace} || {
        echo -e "${RED}✗ StatefulSet ${statefulset} failed to become ready${NC}"
        return 1
    }
    echo -e "${GREEN}✓${NC} StatefulSet ${statefulset} is ready"
}

# Deploy using kustomize
echo ""
echo -e "${YELLOW}Deploying CStore application...${NC}"

if command -v kustomize &> /dev/null; then
    echo "Using kustomize..."
    kubectl apply -k ${KUSTOMIZE_DIR}
else
    echo "Using kubectl kustomize..."
    kubectl apply -k ${KUSTOMIZE_DIR}
fi

echo ""
echo -e "${YELLOW}Waiting for resources to be ready...${NC}"

# Wait for namespace
echo -e "${YELLOW}Checking namespace...${NC}"
kubectl get namespace ${NAMESPACE} &> /dev/null && echo -e "${GREEN}✓${NC} Namespace ${NAMESPACE} exists"

# Wait for data layer
echo ""
echo -e "${YELLOW}Waiting for data layer...${NC}"
wait_for_statefulset "mongodb" ${NAMESPACE}
wait_for_deployment "redis" ${NAMESPACE}

# Wait for monitoring stack
echo ""
echo -e "${YELLOW}Waiting for monitoring stack...${NC}"
wait_for_deployment "prometheus" ${NAMESPACE}
wait_for_deployment "redis-exporter" ${NAMESPACE}
wait_for_deployment "grafana" ${NAMESPACE}

# Wait for CDN
echo ""
echo -e "${YELLOW}Waiting for CDN deployment...${NC}"
wait_for_deployment "nginx-cdn" ${NAMESPACE}

# Wait for application
echo ""
echo -e "${YELLOW}Waiting for application...${NC}"
wait_for_deployment "cstore-api" ${NAMESPACE}

# Display status
echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Display service information
echo "Services:"
kubectl get svc -n ${NAMESPACE}

echo ""
echo "Pods:"
kubectl get pods -n ${NAMESPACE}

echo ""
echo "Ingresses:"
kubectl get ingress -n ${NAMESPACE}

echo ""
echo -e "${YELLOW}Access Information:${NC}"
echo "- Grafana: Port-forward with 'kubectl port-forward -n ${NAMESPACE} svc/grafana-service 3001:3001'"
echo "- Prometheus: Port-forward with 'kubectl port-forward -n ${NAMESPACE} svc/prometheus-service 9090:9090'"
echo "- Application: Configure DNS for ingress domains or use port-forward"

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update DNS records for your ingress domains"
echo "2. Configure TLS certificates"
echo "3. Update Grafana admin password"
echo "4. Review and update secrets in production"

exit 0
