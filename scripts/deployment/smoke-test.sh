#!/bin/bash

# Smoke Test Script for CStore Application
# Performs basic functional tests to verify deployment

set -e

URL=${1:-"http://localhost:3000"}
echo "=== CStore Smoke Tests ==="
echo "Testing URL: $URL"
echo ""

passed=0
failed=0

# Test function
test_endpoint() {
    local name=$1
    local method=${2:-GET}
    local endpoint=$3
    local expected_status=${4:-200}
    local data=${5:-""}
    
    echo -n "Testing $name... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$URL$endpoint")
    elif [ "$method" == "POST" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$URL$endpoint")
    fi
    
    if [ "$response" == "$expected_status" ]; then
        echo "✓ PASSED (Status: $response)"
        ((passed++))
        return 0
    else
        echo "✗ FAILED (Expected: $expected_status, Got: $response)"
        ((failed++))
        return 1
    fi
}

# Run smoke tests
echo "Running smoke tests..."
echo ""

# 1. Health check
test_endpoint "Health Check" GET "/api/health" 200

# 2. Products listing
test_endpoint "Products List" GET "/api/products" 200

# 3. Authentication - should fail without credentials (401)
test_endpoint "Auth Protected Route" GET "/api/auth/me" 401

# 4. Orders - should require authentication (401)
test_endpoint "Orders List" GET "/api/orders" 401

# 5. Non-existent endpoint (404)
test_endpoint "404 Handling" GET "/api/non-existent" 404

# 6. API root
test_endpoint "API Root" GET "/api" 200

echo ""
echo "=== Smoke Test Results ==="
echo "Passed: $passed"
echo "Failed: $failed"
echo ""

if [ $failed -eq 0 ]; then
    echo "✓ All smoke tests PASSED"
    exit 0
else
    echo "✗ Some smoke tests FAILED"
    exit 1
fi
