const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

/**
 * Automated Database Backup Service
 * Handles MongoDB backups with S3 integration and retention policies
 */
class BackupService {
  constructor() {
    this.enabled = process.env.BACKUP_ENABLED === 'true';
    this.backupPath = process.env.MONGODB_BACKUP_PATH || '/backups';
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
    this.s3Bucket = process.env.AWS_S3_BACKUP_BUCKET;
    this.mongoUri = process.env.MONGODB_URI;
  }

  /**
   * Create a database backup
   */
  async createBackup() {
    if (!this.enabled) {
      logger.info('Backup service is disabled');
      return { success: false, message: 'Backup disabled' };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.backupPath, timestamp);

    try {
      logger.info(`Starting database backup: ${timestamp}`);

      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });

      // Create MongoDB backup using mongodump
      const dumpCommand = `mongodump --uri="${this.mongoUri}" --out="${backupDir}" --gzip`;
      const { stdout, stderr } = await execAsync(dumpCommand);

      if (stderr && !stderr.includes('done dumping')) {
        logger.warn(`Backup warnings: ${stderr}`);
      }

      logger.info(`Database backup completed: ${backupDir}`);

      // Upload to S3 if configured
      if (this.s3Bucket) {
        await this.uploadToS3(backupDir, timestamp);
      }

      // Cleanup old backups
      await this.cleanupOldBackups();

      return {
        success: true,
        timestamp,
        path: backupDir,
        message: 'Backup completed successfully'
      };
    } catch (error) {
      logger.error('Backup failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Backup failed'
      };
    }
  }

  /**
   * Upload backup to S3
   */
  async uploadToS3(backupDir, timestamp) {
    try {
      logger.info(`Uploading backup to S3: ${this.s3Bucket}/${timestamp}`);

      const syncCommand = `aws s3 sync "${backupDir}" "s3://${this.s3Bucket}/${timestamp}/" --storage-class STANDARD_IA`;
      await execAsync(syncCommand);

      logger.info('Backup uploaded to S3 successfully');
    } catch (error) {
      logger.error('S3 upload failed:', error);
      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(backupPath) {
    if (!this.enabled) {
      logger.info('Backup service is disabled');
      return { success: false, message: 'Backup disabled' };
    }

    try {
      logger.info(`Starting database restore from: ${backupPath}`);

      // Verify backup exists
      await fs.access(backupPath);

      // Restore using mongorestore
      const restoreCommand = `mongorestore --uri="${this.mongoUri}" "${backupPath}" --gzip --drop`;
      const { stdout, stderr } = await execAsync(restoreCommand);

      if (stderr && !stderr.includes('done')) {
        logger.warn(`Restore warnings: ${stderr}`);
      }

      logger.info('Database restore completed successfully');

      return {
        success: true,
        path: backupPath,
        message: 'Restore completed successfully'
      };
    } catch (error) {
      logger.error('Restore failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Restore failed'
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const backups = await fs.readdir(this.backupPath);
      const backupDetails = await Promise.all(
        backups.map(async (backup) => {
          const backupPath = path.join(this.backupPath, backup);
          const stats = await fs.stat(backupPath);
          return {
            name: backup,
            path: backupPath,
            created: stats.mtime,
            size: stats.size
          };
        })
      );

      return backupDetails.sort((a, b) => b.created - a.created);
    } catch (error) {
      logger.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      let deletedCount = 0;

      for (const backup of backups) {
        if (backup.created < cutoffDate) {
          logger.info(`Deleting old backup: ${backup.name}`);
          await fs.rm(backup.path, { recursive: true, force: true });
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old backup(s)`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath) {
    try {
      logger.info(`Verifying backup: ${backupPath}`);

      // Check if backup directory exists and has content
      const stats = await fs.stat(backupPath);
      if (!stats.isDirectory()) {
        return { valid: false, message: 'Backup path is not a directory' };
      }

      // Check for database files
      const files = await fs.readdir(backupPath);
      if (files.length === 0) {
        return { valid: false, message: 'Backup directory is empty' };
      }

      return {
        valid: true,
        message: 'Backup appears valid',
        files: files.length
      };
    } catch (error) {
      logger.error('Backup verification failed:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get backup status and statistics
   */
  async getBackupStatus() {
    const backups = await this.listBackups();
    const latestBackup = backups[0];

    return {
      enabled: this.enabled,
      totalBackups: backups.length,
      latestBackup: latestBackup ? {
        name: latestBackup.name,
        created: latestBackup.created,
        age: Math.floor((Date.now() - latestBackup.created) / (1000 * 60 * 60))
      } : null,
      retentionDays: this.retentionDays,
      backupPath: this.backupPath,
      s3Enabled: !!this.s3Bucket
    };
  }
}

module.exports = new BackupService();
