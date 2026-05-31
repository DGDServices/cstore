/**
 * Database High Availability Configuration
 * Defines replica sets, connection pooling, and failover settings
 */

module.exports = {
  // MongoDB connection configuration
  mongodb: {
    // Replica set configuration
    replicaSet: {
      enabled: process.env.MONGODB_REPLICA_SET ? true : false,
      name: process.env.MONGODB_REPLICA_SET || 'cryptons-rs',
      
      // Replica set members
      members: process.env.MONGODB_REPLICA_MEMBERS
        ? process.env.MONGODB_REPLICA_MEMBERS.split(',')
        : [
            'mongodb-primary:27017',
            'mongodb-secondary1:27017',
            'mongodb-secondary2:27017'
          ],
      
      // Read preference
      readPreference: process.env.MONGODB_READ_PREFERENCE || 'primaryPreferred',
      // Options: primary, primaryPreferred, secondary, secondaryPreferred, nearest
      
      // Write concern
      writeConcern: {
        w: process.env.MONGODB_WRITE_CONCERN || 'majority',
        j: true, // Journal writes
        wtimeout: parseInt(process.env.MONGODB_WRITE_TIMEOUT || '5000', 10)
      },
      
      // Read concern
      readConcern: {
        level: process.env.MONGODB_READ_CONCERN || 'majority'
        // Options: local, available, majority, linearizable, snapshot
      }
    },

    // Connection pool configuration
    pool: {
      minSize: parseInt(process.env.MONGODB_POOL_MIN || '5', 10),
      maxSize: parseInt(process.env.MONGODB_POOL_SIZE || '20', 10),
      
      // Connection timeout (ms)
      connectTimeout: parseInt(process.env.MONGODB_CONNECT_TIMEOUT || '10000', 10),
      
      // Socket timeout (ms)
      socketTimeout: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '45000', 10),
      
      // Server selection timeout (ms)
      serverSelectionTimeout: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT || '30000', 10),
      
      // Max idle time (ms)
      maxIdleTime: parseInt(process.env.MONGODB_MAX_IDLE_TIME || '60000', 10),
      
      // Wait queue timeout (ms)
      waitQueueTimeout: parseInt(process.env.MONGODB_WAIT_QUEUE_TIMEOUT || '10000', 10)
    },

    // Failover configuration
    failover: {
      // Automatic failover enabled
      autoFailover: true,
      
      // Failover timeout (ms)
      timeout: parseInt(process.env.FAILOVER_TIMEOUT || '5000', 10),
      
      // Retry attempts on failover
      retryAttempts: 3,
      
      // Retry delay (ms)
      retryDelay: 1000,
      
      // Health check interval (ms)
      healthCheckInterval: 10000
    },

    // Connection retry strategy
    retry: {
      // Retry writes on network errors
      retryWrites: true,
      
      // Retry reads on network errors
      retryReads: true,
      
      // Maximum retry attempts
      maxAttempts: 3,
      
      // Initial retry delay (ms)
      initialDelay: 100,
      
      // Maximum retry delay (ms)
      maxDelay: 5000,
      
      // Backoff multiplier
      multiplier: 2
    },

    // Monitoring and logging
    monitoring: {
      // Enable connection monitoring
      enabled: true,
      
      // Log slow queries (ms)
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10),
      
      // Log all queries in development
      logQueries: process.env.NODE_ENV === 'development',
      
      // Command monitoring
      commandMonitoring: true,
      
      // Server monitoring
      serverMonitoring: true
    },

    // Compression
    compression: {
      enabled: process.env.MONGODB_COMPRESSION === 'true',
      compressors: ['snappy', 'zlib', 'zstd']
    }
  },

  // Load balancing
  loadBalancing: {
    enabled: true,
    
    // Strategy for distributing reads
    strategy: 'round-robin', // or 'least-connections', 'random'
    
    // Session affinity
    sessionAffinity: false,
    
    // Health check configuration
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000,
      unhealthyThreshold: 3,
      healthyThreshold: 2
    }
  },

  // Backup and recovery integration
  backup: {
    // Enable continuous backup
    continuousBackup: true,
    
    // Backup from secondary to reduce primary load
    backupFromSecondary: true,
    
    // Oplog retention (hours)
    oplogRetention: 24
  },

  // Sharding configuration (for future scaling)
  sharding: {
    enabled: false,
    
    // Shard key
    shardKey: {
      // Example: { userId: 'hashed' }
    },
    
    // Number of shards
    shards: 3,
    
    // Config servers
    configServers: []
  },

  // Performance optimization
  performance: {
    // Index optimization
    indexes: {
      // Auto-create recommended indexes
      autoCreate: true,
      
      // Background index creation
      background: true,
      
      // Index usage monitoring
      monitoring: true
    },
    
    // Query optimization
    queries: {
      // Use query hints
      useHints: false,
      
      // Explain plans for slow queries
      explainSlowQueries: true,
      
      // Query timeout (ms)
      timeout: 30000
    },
    
    // Connection optimization
    connection: {
      // Use connection pooling
      pooling: true,
      
      // Keep connections alive
      keepAlive: true,
      keepAliveInitialDelay: 300000
    }
  },

  // Disaster recovery
  disasterRecovery: {
    // Geographic distribution
    multiRegion: {
      enabled: false,
      regions: ['us-east-1', 'eu-west-1']
    },
    
    // Automated failover
    autoFailover: {
      enabled: true,
      crossRegion: false
    },
    
    // Recovery procedures
    procedures: {
      rto: 60, // Recovery Time Objective (minutes)
      rpo: 15  // Recovery Point Objective (minutes)
    }
  },

  // Security
  security: {
    // TLS/SSL
    tls: {
      enabled: process.env.MONGODB_TLS_ENABLED === 'true',
      ca: process.env.MONGODB_TLS_CA_FILE,
      cert: process.env.MONGODB_TLS_CERT_FILE,
      key: process.env.MONGODB_TLS_KEY_FILE,
      allowInvalidCertificates: false,
      allowInvalidHostnames: false
    },
    
    // Authentication
    auth: {
      username: process.env.MONGODB_USER,
      password: process.env.MONGODB_PASSWORD,
      authSource: process.env.MONGODB_AUTH_SOURCE || 'admin',
      authMechanism: process.env.MONGODB_AUTH_MECHANISM || 'SCRAM-SHA-256'
    },
    
    // Encryption at rest
    encryption: {
      enabled: process.env.MONGODB_ENCRYPTION_ENABLED === 'true',
      keyFile: process.env.MONGODB_ENCRYPTION_KEY_FILE,
      cipher: process.env.MONGODB_ENCRYPTION_CIPHER || 'AES256-GCM'
    }
  },

  // Alerts and notifications
  alerts: {
    // Alert on primary failover
    primaryFailover: {
      enabled: true,
      channels: ['email', 'slack']
    },
    
    // Alert on replica lag
    replicaLag: {
      enabled: true,
      threshold: 10, // seconds
      channels: ['slack']
    },
    
    // Alert on connection pool exhaustion
    poolExhaustion: {
      enabled: true,
      threshold: 0.9, // 90% utilization
      channels: ['slack']
    }
  }
};
