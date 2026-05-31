#!/bin/bash
# Database Restore Script

set -e

# Configuration
BACKUP_DIR="${MONGODB_BACKUP_PATH:-/backups}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/cryptons}"
LOG_FILE="${BACKUP_DIR}/restore.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOG_FILE}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "${LOG_FILE}"
}

# List available backups
list_backups() {
    log_info "Available backups:"
    local backups=($(ls -td ${BACKUP_DIR}/*/ 2>/dev/null))
    
    if [ ${#backups[@]} -eq 0 ]; then
        log_warning "No backups found in ${BACKUP_DIR}"
        return 1
    fi
    
    local i=1
    for backup in "${backups[@]}"; do
        local backup_name=$(basename "$backup")
        local backup_size=$(du -sh "$backup" | cut -f1)
        local backup_time=$(stat -c %y "$backup" | cut -d'.' -f1)
        echo "  ${i}. ${backup_name} (${backup_size}) - ${backup_time}"
        ((i++))
    done
}

# Verify backup before restore
verify_backup() {
    local backup_path=$1
    
    log "Verifying backup: ${backup_path}"
    
    if [ ! -d "${backup_path}" ]; then
        log_error "Backup path does not exist: ${backup_path}"
        return 1
    fi
    
    local file_count=$(find "${backup_path}" -type f | wc -l)
    if [ "${file_count}" -eq 0 ]; then
        log_error "Backup directory is empty"
        return 1
    fi
    
    log_success "Backup verification passed (${file_count} files)"
    return 0
}

# Create pre-restore backup
create_pre_restore_backup() {
    log "Creating pre-restore backup..."
    local pre_restore_path="${BACKUP_DIR}/pre-restore-$(date +%Y%m%d_%H%M%S)"
    
    if mongodump --uri="${MONGODB_URI}" --out="${pre_restore_path}" --gzip; then
        log_success "Pre-restore backup created: ${pre_restore_path}"
        echo "${pre_restore_path}"
        return 0
    else
        log_error "Failed to create pre-restore backup"
        return 1
    fi
}

# Perform restore
restore_mongodb() {
    local backup_path=$1
    local drop_existing=${2:-true}
    
    log "Starting MongoDB restore from: ${backup_path}"
    
    local restore_cmd="mongorestore --uri=\"${MONGODB_URI}\" \"${backup_path}\" --gzip"
    
    if [ "${drop_existing}" = "true" ]; then
        restore_cmd="${restore_cmd} --drop"
        log_warning "Existing collections will be dropped"
    fi
    
    if eval "${restore_cmd}"; then
        log_success "MongoDB restore completed"
        return 0
    else
        log_error "MongoDB restore failed"
        return 1
    fi
}

# Verify restore success
verify_restore() {
    log "Verifying restore..."
    
    # Try to connect and run a simple query
    if mongosh --uri="${MONGODB_URI}" --quiet --eval "db.runCommand('ping')" > /dev/null 2>&1; then
        log_success "Database connection verified"
        return 0
    else
        log_error "Database verification failed"
        return 1
    fi
}

# Interactive restore
interactive_restore() {
    log_info "=========================================="
    log_info "MongoDB Restore Utility"
    log_info "=========================================="
    
    # List available backups
    if ! list_backups; then
        exit 1
    fi
    
    # Prompt for backup selection
    echo ""
    read -p "Enter backup number to restore (or 'q' to quit): " backup_choice
    
    if [ "${backup_choice}" = "q" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
    
    # Get selected backup
    local backups=($(ls -td ${BACKUP_DIR}/*/ 2>/dev/null))
    local selected_index=$((backup_choice - 1))
    
    if [ ${selected_index} -lt 0 ] || [ ${selected_index} -ge ${#backups[@]} ]; then
        log_error "Invalid backup number"
        exit 1
    fi
    
    local backup_path="${backups[$selected_index]}"
    log_info "Selected backup: ${backup_path}"
    
    # Verify backup
    if ! verify_backup "${backup_path}"; then
        exit 1
    fi
    
    # Confirmation
    echo ""
    log_warning "⚠️  WARNING: This will replace your current database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "${confirm}" != "yes" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
    
    # Create pre-restore backup
    local pre_restore_backup
    if pre_restore_backup=$(create_pre_restore_backup); then
        log_info "You can rollback using: ${pre_restore_backup}"
    else
        read -p "Pre-restore backup failed. Continue anyway? (yes/no): " continue_anyway
        if [ "${continue_anyway}" != "yes" ]; then
            exit 1
        fi
    fi
    
    # Perform restore
    if restore_mongodb "${backup_path}"; then
        # Verify restore
        if verify_restore; then
            log_success "=========================================="
            log_success "Restore completed successfully!"
            log_success "=========================================="
            exit 0
        else
            log_error "Restore verification failed"
            exit 1
        fi
    else
        log_error "Restore failed"
        if [ -n "${pre_restore_backup}" ]; then
            log_info "You can rollback using: $0 --backup-path ${pre_restore_backup}"
        fi
        exit 1
    fi
}

# Non-interactive restore
non_interactive_restore() {
    local backup_path=$1
    
    log_info "=========================================="
    log_info "MongoDB Restore (Non-Interactive)"
    log_info "=========================================="
    
    if ! verify_backup "${backup_path}"; then
        exit 1
    fi
    
    if restore_mongodb "${backup_path}"; then
        if verify_restore; then
            log_success "Restore completed successfully"
            exit 0
        else
            log_error "Restore verification failed"
            exit 1
        fi
    else
        log_error "Restore failed"
        exit 1
    fi
}

# Usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --backup-path PATH    Restore from specific backup path"
    echo "  --latest              Restore from latest backup"
    echo "  --list                List available backups"
    echo "  --help                Show this help message"
    echo ""
    echo "Without options, runs in interactive mode"
}

# Main function
main() {
    case "${1}" in
        --backup-path)
            non_interactive_restore "${2}"
            ;;
        --latest)
            local latest_backup=$(ls -td ${BACKUP_DIR}/*/ 2>/dev/null | head -1)
            if [ -n "${latest_backup}" ]; then
                non_interactive_restore "${latest_backup}"
            else
                log_error "No backups found"
                exit 1
            fi
            ;;
        --list)
            list_backups
            ;;
        --help)
            usage
            ;;
        *)
            interactive_restore
            ;;
    esac
}

# Run main function
main "$@"
