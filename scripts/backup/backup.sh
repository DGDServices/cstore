#!/bin/bash
# Automated Database Backup Script

set -e

# Configuration
BACKUP_DIR="${MONGODB_BACKUP_PATH:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/cryptons}"
S3_BUCKET="${AWS_S3_BACKUP_BUCKET}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if backup is enabled
if [ "${BACKUP_ENABLED}" != "true" ]; then
    log_warning "Backup is disabled (BACKUP_ENABLED != true)"
    exit 0
fi

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v mongodump &> /dev/null; then
        missing_deps+=("mongodump")
    fi
    
    if [ -n "${S3_BUCKET}" ] && ! command -v aws &> /dev/null; then
        missing_deps+=("aws-cli")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "${BACKUP_DIR}" ]; then
        mkdir -p "${BACKUP_DIR}"
        log "Created backup directory: ${BACKUP_DIR}"
    fi
    
    mkdir -p "${BACKUP_PATH}"
    log "Created backup path: ${BACKUP_PATH}"
}

# Perform MongoDB backup
backup_mongodb() {
    log "Starting MongoDB backup..."
    
    if mongodump --uri="${MONGODB_URI}" --out="${BACKUP_PATH}" --gzip; then
        log_success "MongoDB backup completed"
        return 0
    else
        log_error "MongoDB backup failed"
        return 1
    fi
}

# Calculate backup size
get_backup_size() {
    du -sh "${BACKUP_PATH}" | cut -f1
}

# Upload to S3
upload_to_s3() {
    if [ -z "${S3_BUCKET}" ]; then
        log_warning "S3 bucket not configured, skipping upload"
        return 0
    fi
    
    log "Uploading backup to S3: s3://${S3_BUCKET}/${TIMESTAMP}/"
    
    if aws s3 sync "${BACKUP_PATH}" "s3://${S3_BUCKET}/${TIMESTAMP}/" \
        --storage-class STANDARD_IA \
        --quiet; then
        log_success "Backup uploaded to S3"
        return 0
    else
        log_error "S3 upload failed"
        return 1
    fi
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    # Check if backup directory exists and has content
    if [ ! -d "${BACKUP_PATH}" ]; then
        log_error "Backup directory does not exist"
        return 1
    fi
    
    local file_count=$(find "${BACKUP_PATH}" -type f | wc -l)
    if [ "${file_count}" -eq 0 ]; then
        log_error "Backup directory is empty"
        return 1
    fi
    
    log_success "Backup verification passed (${file_count} files)"
    return 0
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    local deleted_count=0
    find "${BACKUP_DIR}" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} ! -path "${BACKUP_DIR}" | while read -r old_backup; do
        log "Deleting old backup: ${old_backup}"
        rm -rf "${old_backup}"
        ((deleted_count++))
    done
    
    if [ ${deleted_count} -gt 0 ]; then
        log_success "Cleaned up ${deleted_count} old backup(s)"
    else
        log "No old backups to clean up"
    fi
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${ALERT_WEBHOOK_URL}" ]; then
        curl -X POST "${ALERT_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{\"status\": \"${status}\", \"message\": \"${message}\", \"timestamp\": \"${TIMESTAMP}\"}" \
            --silent --show-error || true
    fi
}

# Main backup process
main() {
    log "=========================================="
    log "Starting backup process"
    log "Timestamp: ${TIMESTAMP}"
    log "=========================================="
    
    # Check dependencies
    check_dependencies
    
    # Create backup directory
    create_backup_dir
    
    # Perform backup
    if ! backup_mongodb; then
        log_error "Backup failed"
        send_notification "failed" "MongoDB backup failed at ${TIMESTAMP}"
        exit 1
    fi
    
    # Get backup size
    local backup_size=$(get_backup_size)
    log "Backup size: ${backup_size}"
    
    # Verify backup
    if ! verify_backup; then
        log_error "Backup verification failed"
        send_notification "failed" "Backup verification failed at ${TIMESTAMP}"
        exit 1
    fi
    
    # Upload to S3
    upload_to_s3
    
    # Clean up old backups
    cleanup_old_backups
    
    log "=========================================="
    log_success "Backup completed successfully"
    log "Backup path: ${BACKUP_PATH}"
    log "Backup size: ${backup_size}"
    log "=========================================="
    
    send_notification "success" "Backup completed successfully at ${TIMESTAMP} (${backup_size})"
}

# Run main function
main "$@"
