#!/bin/bash

# Rollback Script for Cryptons Application
# Rolls back to previous deployment version

set -e

ENVIRONMENT=${1:-"staging"}
PREVIOUS_VERSION=${2:-""}

echo "=== Cryptons Deployment Rollback ==="
echo "Environment: $ENVIRONMENT"
echo "Rolling back to: ${PREVIOUS_VERSION:-'previous version'}"
echo ""

# Function to rollback Kubernetes deployment
rollback_kubernetes() {
    local environment=$1
    local deployment_name="cryptons-$environment"
    
    echo "Rolling back Kubernetes deployment: $deployment_name"
    
    if [ -n "$PREVIOUS_VERSION" ]; then
        kubectl rollout undo deployment/$deployment_name --to-revision=$PREVIOUS_VERSION
    else
        kubectl rollout undo deployment/$deployment_name
    fi
    
    echo "Waiting for rollback to complete..."
    kubectl rollout status deployment/$deployment_name --timeout=5m
    
    if [ $? -eq 0 ]; then
        echo "✓ Rollback completed successfully"
        return 0
    else
        echo "✗ Rollback failed"
        return 1
    fi
}

# Function to switch traffic in blue-green deployment
switch_traffic() {
    local environment=$1
    local target_version=${2:-"green"} # green = previous stable version
    
    echo "Switching traffic to $target_version environment"
    
    # Update service selector
    kubectl patch service cryptons-$environment -p "{\"spec\":{\"selector\":{\"version\":\"$target_version\"}}}"
    
    echo "✓ Traffic switched to $target_version"
}

# Function to verify rollback
verify_rollback() {
    local environment=$1
    local url=""
    
    case $environment in
        development)
            url="https://dev.cryptons.com"
            ;;
        staging)
            url="https://staging.cryptons.com"
            ;;
        production)
            url="https://cryptons.com"
            ;;
        *)
            echo "Unknown environment: $environment"
            return 1
            ;;
    esac
    
    echo "Verifying rollback at $url"
    
    # Run health check
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url/api/health")
    
    if [ "$response" == "200" ]; then
        echo "✓ Health check passed"
        return 0
    else
        echo "✗ Health check failed (Status: $response)"
        return 1
    fi
}

# Main rollback process
main() {
    echo "Starting rollback process..."
    
    # Confirm rollback
    read -p "Are you sure you want to rollback $ENVIRONMENT? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Rollback cancelled"
        exit 0
    fi
    
    # Switch traffic to previous version (blue-green)
    switch_traffic "$ENVIRONMENT" "green"
    
    # Rollback deployment
    if rollback_kubernetes "$ENVIRONMENT"; then
        echo "Verifying rollback..."
        
        if verify_rollback "$ENVIRONMENT"; then
            echo ""
            echo "=== Rollback Successful ==="
            echo "Environment $ENVIRONMENT has been rolled back"
            exit 0
        else
            echo ""
            echo "=== Rollback Verification Failed ==="
            echo "Please check the deployment manually"
            exit 1
        fi
    else
        echo ""
        echo "=== Rollback Failed ==="
        exit 1
    fi
}

# Execute main function
main
