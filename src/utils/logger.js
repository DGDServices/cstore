const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'cryptons-api' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write error logs to error.log
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// Create dedicated security logger for multi-sig operations
const securityLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'cryptons-security', category: 'multi-sig' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/security.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  ]
});

// Helper function to log multi-sig operations
logger.logMultiSigOperation = (operation, details) => {
  const logEntry = {
    operation,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  // Log to both main logger and security logger
  logger.info(`Multi-sig ${operation}`, logEntry);
  securityLogger.info(`Multi-sig ${operation}`, logEntry);
};

module.exports = logger;
