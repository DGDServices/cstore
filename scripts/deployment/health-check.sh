#!/bin/bash

# Health Check Script for CStore Application
# Usage: ./health-check.sh <environment-url> [timeout] [max-retries]

set -e

# Configuration
URL=${1:-"http://localhost:3000"}
TIMEOUT=${2:-30}
MAX_RETRIES=${3:-10}
RETRY_DELAY=5

echo "=== CStore Health Check ==="
echo "URL: $URL"
echo "Timeout: ${TIMEOUT}s"
echo "Max Retries: $MAX_RETRIES"
echo ""

# Function to check health endpoint
check_health() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url/api/health" 2>&1)
    echo $response
}

# Function to check database connection
check_database() {
    local url=$1
    local response=$(curl -s --max-time $TIMEOUT "$url/api/health" 2>&1)
    
    if echo "$response" | grep -q '"database".*"connected"'; then
        return 0
    else
        return 1
    fi
}

# Main health check loop
retry_count=0
success=false

while [ $retry_count -lt $MAX_RETRIES ]; do
    echo "Attempt $((retry_count + 1)) of $MAX_RETRIES..."
    
    # Check HTTP status
    http_code=$(check_health "$URL")
    
    if [ "$http_code" == "200" ]; then
        echo "✓ Health endpoint returned 200 OK"
        
        # Check database connection
        if check_database "$URL"; then
            echo "✓ Database connection is healthy"
            success=true
            break
        else
            echo "✗ Database connection failed"
        fi
    else
        echo "✗ Health endpoint returned: $http_code"
    fi
    
    retry_count=$((retry_count + 1))
    
    if [ $retry_count -lt $MAX_RETRIES ]; then
        echo "Waiting ${RETRY_DELAY}s before next attempt..."
        sleep $RETRY_DELAY
    fi
done

echo ""

if [ "$success" = true ]; then
    echo "=== Health Check PASSED ==="
    exit 0
else
    echo "=== Health Check FAILED ==="
    echo "Application did not become healthy after $MAX_RETRIES attempts"
    exit 1
fi
