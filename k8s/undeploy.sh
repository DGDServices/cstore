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

echo -e "${RED}CStore Kubernetes Undeployment Script${NC}"
echo "========================================"

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

# Check if namespace exists
if ! kubectl get namespace ${NAMESPACE} &> /dev/null; then
    echo -e "${YELLOW}Namespace ${NAMESPACE} does not exist. Nothing to undeploy.${NC}"
    exit 0
fi

# Confirm deletion
echo ""
echo -e "${RED}WARNING: This will delete all resources in the ${NAMESPACE} namespace!${NC}"
echo -e "${YELLOW}This includes:${NC}"
echo "  - All deployments, pods, and services"
echo "  - All persistent volumes and data"
echo "  - All configuration and secrets"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${GREEN}Undeployment cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Undeploying CStore application...${NC}"

# Delete using kustomize
if command -v kustomize &> /dev/null; then
    echo "Using kustomize..."
    kubectl delete -k ${KUSTOMIZE_DIR} --ignore-not-found=true
else
    echo "Using kubectl kustomize..."
    kubectl delete -k ${KUSTOMIZE_DIR} --ignore-not-found=true
fi

echo ""
echo -e "${YELLOW}Waiting for resources to be deleted...${NC}"
sleep 5

# Check if any pods remain
remaining_pods=$(kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | wc -l)
if [ "$remaining_pods" -gt 0 ]; then
    echo -e "${YELLOW}Waiting for ${remaining_pods} pods to terminate...${NC}"
    kubectl wait --for=delete pod --all -n ${NAMESPACE} --timeout=120s || true
fi

# Delete PVCs if they still exist
echo ""
echo -e "${YELLOW}Checking for remaining PVCs...${NC}"
pvcs=$(kubectl get pvc -n ${NAMESPACE} --no-headers 2>/dev/null | wc -l)
if [ "$pvcs" -gt 0 ]; then
    echo -e "${RED}Warning: ${pvcs} PVCs still exist. Delete them manually if needed:${NC}"
    kubectl get pvc -n ${NAMESPACE}
    echo ""
    read -p "Delete all PVCs? This will delete all data! (yes/no): " -r
    echo
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        kubectl delete pvc --all -n ${NAMESPACE}
        echo -e "${GREEN}✓${NC} PVCs deleted"
    fi
fi

# Optionally delete the namespace
echo ""
read -p "Delete the namespace ${NAMESPACE}? (yes/no): " -r
echo
if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    kubectl delete namespace ${NAMESPACE} --ignore-not-found=true
    echo -e "${GREEN}✓${NC} Namespace deleted"
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Undeployment completed!${NC}"
echo -e "${GREEN}=====================================${NC}"

exit 0
