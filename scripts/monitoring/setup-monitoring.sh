#!/bin/bash
# Monitoring Stack Setup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker is installed"
}

# Check if Docker Compose is installed
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    log_success "Docker Compose is installed"
}

# Start monitoring stack
start_monitoring() {
    log_info "Starting monitoring stack..."
    
    cd "$(dirname "$0")/../../infrastructure"
    
    if docker-compose -f docker-compose.monitoring.yml up -d; then
        log_success "Monitoring stack started"
    else
        log_error "Failed to start monitoring stack"
        exit 1
    fi
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    # Wait for Prometheus
    log_info "Checking Prometheus..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:9090/-/ready > /dev/null 2>&1; then
            log_success "Prometheus is ready"
            break
        fi
        ((attempt++))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warning "Prometheus did not become ready"
    fi
    
    # Wait for Grafana
    attempt=0
    log_info "Checking Grafana..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
            log_success "Grafana is ready"
            break
        fi
        ((attempt++))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warning "Grafana did not become ready"
    fi
}

# Display access information
display_info() {
    log_info "=========================================="
    log_info "Monitoring Stack Setup Complete!"
    log_info "=========================================="
    echo ""
    log_info "Access URLs:"
    echo "  Prometheus:    http://localhost:9090"
    echo "  Grafana:       http://localhost:3001"
    echo "  Alertmanager:  http://localhost:9093"
    echo "  Node Exporter: http://localhost:9100"
    echo "  cAdvisor:      http://localhost:8080"
    echo ""
    log_info "Default Grafana Credentials:"
    echo "  Username: admin"
    echo "  Password: ${GRAFANA_ADMIN_PASSWORD:-admin}"
    echo ""
    log_warning "⚠️  Remember to change the default password!"
    echo ""
}

# Main function
main() {
    log_info "=========================================="
    log_info "Cryptons Monitoring Stack Setup"
    log_info "=========================================="
    echo ""
    
    # Check prerequisites
    check_docker
    check_docker_compose
    
    # Start monitoring stack
    start_monitoring
    
    # Wait for services
    wait_for_services
    
    # Display access information
    display_info
    
    log_success "Setup complete!"
}

# Run main function
main "$@"
