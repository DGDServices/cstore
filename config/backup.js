/**
 * Backup and Recovery Configuration
 * Defines backup schedules, retention, and restore procedures
 */

module.exports = {
  // Enable/disable automated backups
  enabled: process.env.BACKUP_ENABLED === 'true',

  // Backup schedule (cron format)
  schedule: {
    // Full backup daily at 2 AM
    full: process.env.BACKUP_SCHEDULE || '0 2 * * *',
    
    // Incremental backup every 6 hours
    incremental: '0 */6 * * *',
    
    // Transaction log backup every hour
    transactionLog: '0 * * * *'
  },

  // Backup storage
  storage: {
    // Local backup path
    local: {
      enabled: true,
      path: process.env.MONGODB_BACKUP_PATH || '/backups',
      compression: 'gzip'
    },
    
    // S3 backup storage
    s3: {
      enabled: !!process.env.AWS_S3_BACKUP_BUCKET,
      bucket: process.env.AWS_S3_BACKUP_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      storageClass: 'STANDARD_IA', // Infrequent Access for cost savings
      encryption: 'AES256'
    },
    
    // Azure Blob Storage (alternative)
    azure: {
      enabled: !!process.env.AZURE_STORAGE_ACCOUNT,
      account: process.env.AZURE_STORAGE_ACCOUNT,
      container: process.env.AZURE_BACKUP_CONTAINER,
      accessKey: process.env.AZURE_STORAGE_KEY
    }
  },

  // Retention policy
  retention: {
    // Local retention (days)
    local: {
      full: parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10),
      incremental: 3,
      transactionLog: 1
    },
    
    // Cloud retention (days)
    cloud: {
      full: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
      incremental: 7,
      transactionLog: 3
    },
    
    // Archive policy (move old backups to glacier/archive storage)
    archive: {
      enabled: true,
      afterDays: 90,
      storageClass: 'GLACIER'
    }
  },

  // Backup verification
  verification: {
    // Verify backup integrity after creation
    enabled: true,
    
    // Test restore on separate database
    testRestore: process.env.BACKUP_TEST_RESTORE === 'true',
    
    // Verification schedule (weekly)
    schedule: '0 3 * * 0'
  },

  // Backup notifications
  notifications: {
    // Notify on backup success
    onSuccess: {
      enabled: false,
      channels: ['email']
    },
    
    // Notify on backup failure (always)
    onFailure: {
      enabled: true,
      channels: ['email', 'slack', 'webhook']
    },
    
    // Daily backup report
    dailyReport: {
      enabled: true,
      time: '08:00',
      channels: ['email']
    }
  },

  // Database-specific settings
  database: {
    mongodb: {
      // Connection URI
      uri: process.env.MONGODB_URI,
      
      // Backup options
      options: {
        gzip: true,
        oplog: true, // Include oplog for point-in-time recovery
        excludeCollections: ['sessions', 'cache'], // Skip temporary collections
        numParallelCollections: 4 // Parallel backup for speed
      },
      
      // Point-in-time recovery
      pointInTimeRecovery: {
        enabled: true,
        retentionDays: 7
      }
    }
  },

  // Restore procedures
  restore: {
    // Restore strategy
    strategy: 'stop-and-restore', // or 'rolling-restore' for zero-downtime
    
    // Pre-restore validation
    validation: {
      enabled: true,
      checks: [
        'backup_exists',
        'backup_integrity',
        'backup_compatibility',
        'sufficient_space'
      ]
    },
    
    // Post-restore validation
    postRestore: {
      enabled: true,
      checks: [
        'data_integrity',
        'index_validity',
        'connection_test',
        'sample_query'
      ]
    },
    
    // Automatic rollback on failure
    autoRollback: true,
    
    // Restore timeout (minutes)
    timeout: 60
  },

  // Disaster recovery
  disasterRecovery: {
    // RTO (Recovery Time Objective) in minutes
    rto: 60,
    
    // RPO (Recovery Point Objective) in minutes
    rpo: 15,
    
    // DR site configuration
    drSite: {
      enabled: !!process.env.DR_SITE_ENABLED,
      location: process.env.DR_SITE_LOCATION,
      replicationType: 'async' // or 'sync' for zero data loss
    },
    
    // Failover procedure
    failover: {
      automatic: false, // Manual approval required
      healthCheckInterval: 60,
      failureThreshold: 3
    }
  },

  // Backup monitoring
  monitoring: {
    // Track backup metrics
    metrics: [
      'backup_duration',
      'backup_size',
      'backup_success_rate',
      'restore_duration',
      'storage_usage'
    ],
    
    // Alert on anomalies
    alerts: {
      // Backup takes longer than usual
      slowBackup: {
        enabled: true,
        thresholdMinutes: 30
      },
      
      // Backup size significantly different
      sizeMismatch: {
        enabled: true,
        thresholdPercent: 20
      },
      
      // Failed backups
      failure: {
        enabled: true,
        consecutive: 2 // Alert after 2 consecutive failures
      }
    }
  }
};
