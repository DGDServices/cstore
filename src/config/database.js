const mongoose = require('mongoose');
const logger = require('../utils/logger');
const databaseHAConfig = require('../../config/database-ha');

const connectDB = async () => {
  try {
    // Skip connection if explicitly requested
    if (process.env.SKIP_DB_CONNECTION === 'true') {
      logger.info('Skipping database connection (SKIP_DB_CONNECTION=true)');
      return;
    }

    // Build connection options
    const options = {
      // Connection pool settings
      minPoolSize: databaseHAConfig.mongodb.pool.minSize,
      maxPoolSize: databaseHAConfig.mongodb.pool.maxSize,
      connectTimeoutMS: databaseHAConfig.mongodb.pool.connectTimeout,
      socketTimeoutMS: databaseHAConfig.mongodb.pool.socketTimeout,
      serverSelectionTimeoutMS: databaseHAConfig.mongodb.pool.serverSelectionTimeout,
      maxIdleTimeMS: databaseHAConfig.mongodb.pool.maxIdleTime,
      
      // Retry settings
      retryWrites: databaseHAConfig.mongodb.retry.retryWrites,
      retryReads: databaseHAConfig.mongodb.retry.retryReads,
    };

    // Add replica set configuration if enabled
    if (databaseHAConfig.mongodb.replicaSet.enabled) {
      options.replicaSet = databaseHAConfig.mongodb.replicaSet.name;
      options.readPreference = databaseHAConfig.mongodb.replicaSet.readPreference;
      options.w = databaseHAConfig.mongodb.replicaSet.writeConcern.w;
      options.journal = databaseHAConfig.mongodb.replicaSet.writeConcern.j;
      options.wtimeout = databaseHAConfig.mongodb.replicaSet.writeConcern.wtimeout;
      options.readConcernLevel = databaseHAConfig.mongodb.replicaSet.readConcern.level;
      
      logger.info(`Connecting to MongoDB replica set: ${databaseHAConfig.mongodb.replicaSet.name}`);
    }

    // Add TLS configuration if enabled
    if (databaseHAConfig.mongodb.security.tls.enabled) {
      options.tls = true;
      options.tlsCAFile = databaseHAConfig.mongodb.security.tls.ca;
      options.tlsCertificateKeyFile = databaseHAConfig.mongodb.security.tls.cert;
      options.tlsAllowInvalidCertificates = databaseHAConfig.mongodb.security.tls.allowInvalidCertificates;
      options.tlsAllowInvalidHostnames = databaseHAConfig.mongodb.security.tls.allowInvalidHostnames;
    }

    // Add compression if enabled
    if (databaseHAConfig.mongodb.compression.enabled) {
      options.compressors = databaseHAConfig.mongodb.compression.compressors;
    }

    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/cryptons',
      options
    );

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    if (databaseHAConfig.mongodb.replicaSet.enabled) {
      logger.info(`MongoDB Replica Set: ${databaseHAConfig.mongodb.replicaSet.name}`);
      logger.info(`Read Preference: ${databaseHAConfig.mongodb.replicaSet.readPreference}`);
    }
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Log slow queries if monitoring is enabled
    if (databaseHAConfig.mongodb.monitoring.enabled) {
      mongoose.set('debug', (collectionName, method, query, doc) => {
        const performanceService = require('../services/performance');
        const startTime = Date.now();
        
        // This is a simplified approach - in production, use proper query monitoring
        process.nextTick(() => {
          const duration = Date.now() - startTime;
          if (duration > databaseHAConfig.mongodb.monitoring.slowQueryThreshold) {
            logger.warn('Slow query detected', {
              collection: collectionName,
              method,
              duration
            });
            performanceService.recordSlowQuery(
              JSON.stringify(query),
              duration,
              collectionName
            );
          }
        });
      });
    }

  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    
    // Don't exit in test environment
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
