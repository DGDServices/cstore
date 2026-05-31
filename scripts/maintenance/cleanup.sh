#!/bin/bash
# Log and Backup Cleanup Script

set -e

# Configuration
BACKUP_DIR="${MONGODB_BACKUP_PATH:-/backups}"
LOG_DIR="./logs"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-14}"
DRY_RUN="${DRY_RUN:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Clean old backups
cleanup_backups() {
    log_info "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
    
    if [ ! -d "${BACKUP_DIR}" ]; then
        log_warning "Backup directory does not exist: ${BACKUP_DIR}"
        return 0
    fi
    
    local deleted_count=0
    local freed_space=0
    
    while IFS= read -r -d '' backup; do
        local backup_size=$(du -sb "${backup}" | cut -f1)
        local backup_name=$(basename "${backup}")
        
        if [ "${DRY_RUN}" = "true" ]; then
            log_info "[DRY RUN] Would delete: ${backup_name} ($(numfmt --to=iec ${backup_size}))"
        else
            log_info "Deleting backup: ${backup_name} ($(numfmt --to=iec ${backup_size}))"
            rm -rf "${backup}"
        fi
        
        ((deleted_count++))
        ((freed_space+=backup_size))
    done < <(find "${BACKUP_DIR}" -maxdepth 1 -type d -mtime +${BACKUP_RETENTION_DAYS} ! -path "${BACKUP_DIR}" -print0)
    
    if [ ${deleted_count} -gt 0 ]; then
        log_success "Deleted ${deleted_count} old backup(s), freed $(numfmt --to=iec ${freed_space})"
    else
        log_info "No old backups to clean up"
    fi
}

# Clean old logs
cleanup_logs() {
    log_info "Cleaning up logs older than ${LOG_RETENTION_DAYS} days..."
    
    if [ ! -d "${LOG_DIR}" ]; then
        log_warning "Log directory does not exist: ${LOG_DIR}"
        return 0
    fi
    
    local deleted_count=0
    local freed_space=0
    
    while IFS= read -r -d '' logfile; do
        local log_size=$(stat -f%z "${logfile}" 2>/dev/null || stat -c%s "${logfile}")
        local log_name=$(basename "${logfile}")
        
        if [ "${DRY_RUN}" = "true" ]; then
            log_info "[DRY RUN] Would delete: ${log_name} ($(numfmt --to=iec ${log_size}))"
        else
            log_info "Deleting log: ${log_name} ($(numfmt --to=iec ${log_size}))"
            rm -f "${logfile}"
        fi
        
        ((deleted_count++))
        ((freed_space+=log_size))
    done < <(find "${LOG_DIR}" -type f -mtime +${LOG_RETENTION_DAYS} -print0)
    
    if [ ${deleted_count} -gt 0 ]; then
        log_success "Deleted ${deleted_count} old log file(s), freed $(numfmt --to=iec ${freed_space})"
    else
        log_info "No old logs to clean up"
    fi
}

# Compress old logs
compress_logs() {
    log_info "Compressing logs older than 7 days..."
    
    if [ ! -d "${LOG_DIR}" ]; then
        return 0
    fi
    
    local compressed_count=0
    
    while IFS= read -r -d '' logfile; do
        if [[ "${logfile}" != *.gz ]]; then
            local log_name=$(basename "${logfile}")
            
            if [ "${DRY_RUN}" = "true" ]; then
                log_info "[DRY RUN] Would compress: ${log_name}"
            else
                log_info "Compressing: ${log_name}"
                gzip "${logfile}"
            fi
            
            ((compressed_count++))
        fi
    done < <(find "${LOG_DIR}" -type f -mtime +7 -print0)
    
    if [ ${compressed_count} -gt 0 ]; then
        log_success "Compressed ${compressed_count} log file(s)"
    else
        log_info "No logs to compress"
    fi
}

# Clean Docker volumes (with caution)
cleanup_docker_volumes() {
    log_info "Cleaning up unused Docker volumes..."
    
    if [ "${DRY_RUN}" = "true" ]; then
        log_info "[DRY RUN] Would run: docker volume prune -f"
        docker volume ls -qf dangling=true
    else
        log_warning "Removing unused Docker volumes..."
        docker volume prune -f
        log_success "Docker volumes cleaned"
    fi
}

# Display disk usage
show_disk_usage() {
    log_info "=========================================="
    log_info "Disk Usage Summary"
    log_info "=========================================="
    
    if [ -d "${BACKUP_DIR}" ]; then
        local backup_size=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
        echo "Backup directory: ${backup_size}"
    fi
    
    if [ -d "${LOG_DIR}" ]; then
        local log_size=$(du -sh "${LOG_DIR}" 2>/dev/null | cut -f1)
        echo "Log directory: ${log_size}"
    fi
    
    echo ""
    df -h | grep -E '(Filesystem|/$|/data|/var)'
}

# Usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --dry-run             Show what would be deleted without actually deleting"
    echo "  --backup-retention N  Set backup retention days (default: 30)"
    echo "  --log-retention N     Set log retention days (default: 14)"
    echo "  --skip-backups        Skip backup cleanup"
    echo "  --skip-logs           Skip log cleanup"
    echo "  --skip-docker         Skip Docker cleanup"
    echo "  --help                Show this help message"
}

# Main function
main() {
    local skip_backups=false
    local skip_logs=false
    local skip_docker=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                log_warning "DRY RUN MODE - No files will be deleted"
                shift
                ;;
            --backup-retention)
                BACKUP_RETENTION_DAYS=$2
                shift 2
                ;;
            --log-retention)
                LOG_RETENTION_DAYS=$2
                shift 2
                ;;
            --skip-backups)
                skip_backups=true
                shift
                ;;
            --skip-logs)
                skip_logs=true
                shift
                ;;
            --skip-docker)
                skip_docker=true
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    log_info "=========================================="
    log_info "Cryptons Cleanup Utility"
    log_info "=========================================="
    echo ""
    
    # Show current disk usage
    show_disk_usage
    echo ""
    
    # Run cleanup tasks
    if [ "${skip_backups}" = false ]; then
        cleanup_backups
        echo ""
    fi
    
    if [ "${skip_logs}" = false ]; then
        compress_logs
        echo ""
        cleanup_logs
        echo ""
    fi
    
    if [ "${skip_docker}" = false ]; then
        cleanup_docker_volumes
        echo ""
    fi
    
    # Show disk usage after cleanup
    log_info "After cleanup:"
    show_disk_usage
    echo ""
    
    log_success "Cleanup complete!"
}

# Run main function
main "$@"
