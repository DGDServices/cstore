# Backup and Recovery Procedures

This document describes the automated backup system and recovery procedures for the Cryptons.com platform.

## Overview

The backup system provides:
- Automated daily backups of MongoDB database
- S3 cloud storage integration
- Configurable retention policies
- Tested restore procedures
- Backup verification and monitoring

## Table of Contents

- [Configuration](#configuration)
- [Automated Backups](#automated-backups)
- [Manual Backups](#manual-backups)
- [Restore Procedures](#restore-procedures)
- [Backup Verification](#backup-verification)
- [Monitoring and Alerts](#monitoring-and-alerts)
- [Disaster Recovery](#disaster-recovery)
- [Troubleshooting](#troubleshooting)

## Configuration

### Environment Variables

```bash
# Enable automated backups
BACKUP_ENABLED=true

# Backup schedule (cron format)
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM

# Retention policy
BACKUP_RETENTION_DAYS=30

# Local backup path
MONGODB_BACKUP_PATH=/backups

# S3 storage (optional)
AWS_S3_BACKUP_BUCKET=cryptons-backups
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key

# Notifications
ALERT_WEBHOOK_URL=https://hooks.slack.com/your-webhook
ALERT_EMAIL=admin@cryptons.com
```

### Backup Configuration

Edit `config/backup.js` to customize:
- Backup schedules
- Retention policies
- Storage destinations
- Notification settings

## Automated Backups

### Schedule

Default schedule: Daily at 2:00 AM UTC

```bash
# Cron format: minute hour day month weekday
BACKUP_SCHEDULE=0 2 * * *
```

### What Gets Backed Up

- Complete MongoDB database
- All collections and indexes
- Database metadata
- Compressed with gzip

### Backup Process

1. Create timestamped backup directory
2. Run mongodump with compression
3. Verify backup integrity
4. Upload to S3 (if configured)
5. Clean up old backups
6. Send notifications

### Setting Up Automated Backups

#### Using Cron

```bash
# Add to crontab
crontab -e

# Add this line:
0 2 * * * /path/to/cryptons/scripts/backup/backup.sh >> /var/log/cryptons-backup.log 2>&1
```

#### Using systemd Timer

Create `/etc/systemd/system/cryptons-backup.service`:

```ini
[Unit]
Description=Cryptons Database Backup
After=network.target

[Service]
Type=oneshot
ExecStart=/path/to/cryptons/scripts/backup/backup.sh
User=cryptons
Environment="BACKUP_ENABLED=true"
```

Create `/etc/systemd/system/cryptons-backup.timer`:

```ini
[Unit]
Description=Run Cryptons Backup Daily

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable the timer:

```bash
sudo systemctl enable cryptons-backup.timer
sudo systemctl start cryptons-backup.timer
```

## Manual Backups

### Create Backup

```bash
# Run backup script directly
npm run backup

# Or use the script
./scripts/backup/backup.sh
```

### Create Backup with Custom Path

```bash
MONGODB_BACKUP_PATH=/custom/path npm run backup
```

## Restore Procedures

### Interactive Restore

```bash
# Run restore script
npm run restore

# Or use the script
./scripts/backup/restore.sh
```

The script will:
1. List available backups
2. Prompt for selection
3. Verify backup integrity
4. Create pre-restore backup
5. Perform restore
6. Verify restoration

### Non-Interactive Restore

```bash
# Restore from specific backup
./scripts/backup/restore.sh --backup-path /backups/20250114_020000

# Restore from latest backup
./scripts/backup/restore.sh --latest
```

### Restore from S3

```bash
# Download backup from S3
aws s3 sync s3://cryptons-backups/20250114_020000/ /backups/20250114_020000/

# Then restore
./scripts/backup/restore.sh --backup-path /backups/20250114_020000
```

### Restore Specific Collection

```bash
# Restore only users collection
mongorestore --uri="mongodb://localhost:27017/cryptons" \
  --nsInclude="cryptons.users" \
  --gzip \
  /backups/20250114_020000/cryptons/users.bson.gz
```

## Backup Verification

### Automated Verification

Backups are automatically verified after creation:
- Directory exists and contains files
- File count validation
- Size validation

### Manual Verification

```bash
# List backup contents
ls -lh /backups/20250114_020000/

# Check backup size
du -sh /backups/20250114_020000/

# Verify BSON files
for file in /backups/20250114_020000/cryptons/*.bson.gz; do
  echo "Checking $file"
  gunzip -t "$file"
done
```

### Test Restore

```bash
# Restore to test database
mongorestore --uri="mongodb://localhost:27017/cryptons_test" \
  --gzip \
  --drop \
  /backups/20250114_020000/
  
# Verify data
mongosh cryptons_test --eval "db.users.count()"
```

## Monitoring and Alerts

### Backup Metrics

Monitor these metrics:
- Backup success/failure rate
- Backup duration
- Backup size
- Time since last successful backup

### Alerts

Configured alerts:
- **Critical**: Backup failed
- **Warning**: Backup takes longer than expected
- **Warning**: Backup size significantly different from previous
- **Critical**: No successful backup in 24+ hours

### Viewing Backup Status

```bash
# Check backup logs
tail -f /backups/backup.log

# List recent backups
ls -lht /backups/ | head -10

# Check S3 backups
aws s3 ls s3://cryptons-backups/ --recursive
```

## Disaster Recovery

### Recovery Time Objective (RTO)

- Target: 60 minutes
- Full restore typically takes 15-30 minutes
- Application restart: 5 minutes

### Recovery Point Objective (RPO)

- Target: 15 minutes
- Daily full backups: 24 hours maximum data loss
- With point-in-time recovery: 15 minutes maximum

### Disaster Recovery Steps

1. **Assess the Situation**
   ```bash
   # Check what's affected
   # Determine if full or partial restore is needed
   ```

2. **Notify Stakeholders**
   - Send incident notification
   - Provide estimated recovery time

3. **Prepare for Restore**
   ```bash
   # Stop application
   docker-compose down
   
   # Verify MongoDB is accessible
   mongosh --uri="${MONGODB_URI}" --eval "db.runCommand('ping')"
   ```

4. **Perform Restore**
   ```bash
   # Restore from latest backup
   ./scripts/backup/restore.sh --latest
   ```

5. **Verify Restoration**
   ```bash
   # Run health checks
   curl http://localhost:3000/api/health
   
   # Check critical data
   mongosh --uri="${MONGODB_URI}" --eval "
     print('Users:', db.users.count());
     print('Orders:', db.orders.count());
     print('Products:', db.products.count());
   "
   ```

6. **Restart Services**
   ```bash
   docker-compose up -d
   ```

7. **Post-Recovery Verification**
   - Test critical user flows
   - Verify data integrity
   - Monitor error logs
   - Check application metrics

8. **Document Incident**
   - What happened
   - Root cause
   - Recovery steps taken
   - Lessons learned

## Troubleshooting

### Backup Failed

**Problem**: Backup script fails

**Solutions**:
1. Check MongoDB connectivity
   ```bash
   mongosh --uri="${MONGODB_URI}" --eval "db.runCommand('ping')"
   ```

2. Verify disk space
   ```bash
   df -h /backups
   ```

3. Check permissions
   ```bash
   ls -la /backups
   ```

4. Review logs
   ```bash
   tail -100 /backups/backup.log
   ```

### Restore Failed

**Problem**: Restore process fails

**Solutions**:
1. Verify backup integrity
   ```bash
   ls -lh /backups/20250114_020000/
   ```

2. Check MongoDB is running
   ```bash
   docker ps | grep mongo
   ```

3. Try restoring to test database first
   ```bash
   mongorestore --uri="mongodb://localhost:27017/test_restore" \
     --gzip /backups/20250114_020000/
   ```

### S3 Upload Failed

**Problem**: Backup not uploading to S3

**Solutions**:
1. Verify AWS credentials
   ```bash
   aws s3 ls s3://cryptons-backups/
   ```

2. Check network connectivity
   ```bash
   ping s3.amazonaws.com
   ```

3. Verify bucket permissions
   ```bash
   aws s3api get-bucket-acl --bucket cryptons-backups
   ```

### Backup Too Large

**Problem**: Backups consuming too much storage

**Solutions**:
1. Reduce retention period
   ```bash
   BACKUP_RETENTION_DAYS=14 ./scripts/backup/backup.sh
   ```

2. Exclude unnecessary collections
   ```javascript
   // In backup.js
   excludeCollections: ['sessions', 'cache', 'temp']
   ```

3. Run cleanup script
   ```bash
   npm run cleanup
   ```

## Best Practices

1. **Test Restores Regularly**
   - Monthly restore tests
   - Verify data integrity
   - Time the process

2. **Monitor Backup Health**
   - Set up alerts
   - Review logs regularly
   - Track backup size trends

3. **Secure Backups**
   - Encrypt backups in transit and at rest
   - Use separate AWS account for backups
   - Implement bucket versioning

4. **Document Everything**
   - Keep this documentation updated
   - Document any manual procedures
   - Maintain runbooks

5. **Automate Recovery**
   - Script common recovery scenarios
   - Test automation regularly
   - Keep scripts up to date

## Support

For issues or questions:
- Check troubleshooting section
- Review backup logs
- Contact DevOps team
- Open GitHub issue

## References

- [MongoDB Backup Methods](https://docs.mongodb.com/manual/core/backups/)
- [AWS S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/best-practices.html)
- [Disaster Recovery Planning](https://www.mongodb.com/basics/disaster-recovery)
