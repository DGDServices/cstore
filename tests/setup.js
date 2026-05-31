const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Don't try to connect via the app in test mode
process.env.SKIP_DB_CONNECTION = 'true';

let isConnected = false;
let mongoServer;

// Setup before all tests
beforeAll(async () => {
  try {
    // First, try to connect to external MongoDB service (CI environment)
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/cstore-test';
    
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000
      });
      isConnected = true;
      console.log('Connected to test database');
      return;
    } catch (serviceError) {
      // MongoDB service not available, try mongodb-memory-server
      console.log('MongoDB service not available, trying in-memory database...');
    }

    // Try to use mongodb-memory-server for in-memory database
    try {
      // Skip download if network is unavailable
      mongoServer = await MongoMemoryServer.create({
        instance: {
          storageEngine: 'ephemeralForTest'
        }
      });
      const mongoUri = mongoServer.getUri();
      
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 3000
      });
      isConnected = true;
      console.log('Connected to in-memory test database');
    } catch (memoryServerError) {
      console.log('Warning: Could not connect to test database. Tests will be skipped.');
      console.log('Run tests in CI with MongoDB service, or start MongoDB locally.');
      isConnected = false;
    }
  } catch (error) {
    console.log('Test setup error:', error.message);
    isConnected = false;
  }
}, 30000); // Timeout for beforeAll

// Cleanup after all tests
afterAll(async () => {
  try {
    if (isConnected) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (error) {
    console.log('Cleanup error:', error.message);
  }
}, 30000);

// Clear database between tests
afterEach(async () => {
  if (isConnected) {
    try {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany();
      }
    } catch (error) {
      console.log('Warning: Could not clear collections:', error.message);
    }
  }
});

// Export connection status for test files
global.isConnected = () => isConnected;
