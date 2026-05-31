const app = require('./src/app');
const logger = require('./src/utils/logger');
const seedData = require('./src/utils/seedData');
const secretsManager = require('./src/services/secretsManager');
const auctionService = require('./src/services/auctionService');

const PORT = process.env.PORT || 3000;

// Initialize secrets manager before starting server
const initializeSecrets = async () => {
  try {
    if (process.env.VAULT_ENABLED === 'true' || process.env.AWS_SECRETS_ENABLED === 'true') {
      logger.info('Initializing secrets manager...');
      await secretsManager.initialize();
      
      // Optionally load secrets and override environment variables
      // This is useful for production where secrets should come from a vault
      if (secretsManager.isReady()) {
        logger.info('Secrets manager initialized successfully');
        // You can load specific secrets here if needed
        // const secrets = await secretsManager.getAllSecrets();
      }
    }
  } catch (error) {
    logger.error('Failed to initialize secrets manager:', error);
    // Continue with environment variables as fallback
  }
};

// Start server
const startServer = async () => {
  // Initialize secrets before starting
  await initializeSecrets();

  const server = app.listen(PORT, async () => {
    logger.info(`Cryptocurrency Marketplace running on http://localhost:${PORT}`);
    logger.info(`API available at http://localhost:${PORT}/api`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Seed initial data if needed
    if (process.env.SEED_DATA === 'true') {
      await seedData();
    }

    // Start auction closer scheduler (checks every 60s for ended auctions)
    auctionService.scheduleAuctionCloser();
    logger.info('Auction closer scheduler started');
  });

  return server;
};

// Start the application
const server = startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
  const serverInstance = await server;
  if (serverInstance) {
    serverInstance.close(async () => {
      await secretsManager.shutdown();
      process.exit(1);
    });
  } else {
    await secretsManager.shutdown();
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', async (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', err);
  await secretsManager.shutdown();
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  const serverInstance = await server;
  if (serverInstance) {
    serverInstance.close(async () => {
      logger.info('HTTP server closed');
      await secretsManager.shutdown();
    });
  }
});

module.exports = server;
