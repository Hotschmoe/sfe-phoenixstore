import { MongoClient } from 'mongodb';
import { config } from '../utils/config';
import { WebSocketManagerConfig } from '../core/WebSocketManager';

// Test database name will be the main database name with a '_test' suffix
const TEST_DB_NAME = `${config.MONGODB_DATABASE}_test`;

interface TestConfig {
  mongodb: {
    host: string;
    port: string;
    user: string;
    password: string;
  };
  websocket: {
    port: number;
    heartbeatInterval: number;
    maxClients: number;
    pingTimeout: number;
    pollingInterval: number;
  };
  storage: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    region: string;
    publicUrl: string;
  };
}

// For tests, we always want to use localhost since tests run outside Docker
export const TEST_CONFIG: TestConfig = {
  mongodb: {
    host: 'localhost',
    port: config.MONGODB_PORT,
    user: config.MONGODB_USER,
    password: config.MONGODB_PASSWORD
  },
  websocket: {
    port: 3002, // Use a different port for tests to avoid conflicts
    heartbeatInterval: 5000, // Longer heartbeat for stability
    maxClients: 100, // Lower limit for tests
    pingTimeout: 5000, // Longer timeout for stability
    pollingInterval: 500 // Faster polling for tests
  },
  storage: {
    endPoint: 'localhost',
    port: config.STORAGE_PORT,
    useSSL: false,
    accessKey: config.STORAGE_ACCESS_KEY,
    secretKey: config.STORAGE_SECRET_KEY,
    region: config.STORAGE_REGION,
    publicUrl: `http://localhost:${config.STORAGE_PORT}`
  }
};

export const getTestDbUri = () => {
  // Create test URI with authentication
  const { host, port, user, password } = TEST_CONFIG.mongodb;
  return `mongodb://${user}:${password}@${host}:${port}/${TEST_DB_NAME}?authSource=admin`;
};

export const getTestStorageConfig = () => TEST_CONFIG.storage;

export const getTestWebSocketConfig = (): Required<WebSocketManagerConfig> => ({
  heartbeatInterval: TEST_CONFIG.websocket.heartbeatInterval,
  maxClients: TEST_CONFIG.websocket.maxClients,
  pingTimeout: TEST_CONFIG.websocket.pingTimeout,
  pollingInterval: TEST_CONFIG.websocket.pollingInterval
});

export const cleanupDatabase = async () => {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(getTestDbUri());
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(TEST_DB_NAME);
    console.log('Cleaning up test database...');
    
    // Drop all collections
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      try {
        await db.collection(collection.name).drop();
        console.log(`Dropped collection: ${collection.name}`);
      } catch (error) {
        console.log(`Error dropping collection ${collection.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    throw error; // Re-throw to fail the test setup
  } finally {
    await client.close();
    console.log('Closed MongoDB connection');
  }
};

// Run before all tests
export const setup = async () => {
  try {
    console.log('Setting up test environment...');
    await cleanupDatabase();
    console.log('Test environment setup complete');
  } catch (error) {
    console.error('Test setup failed:', error);
    process.exit(1); // Exit if we can't set up the test environment
  }
};

// Run after all tests
export const teardown = async () => {
  try {
    console.log('Cleaning up test environment...');
    await cleanupDatabase();
    console.log('Test environment cleanup complete');
  } catch (error) {
    console.error('Test teardown failed:', error);
  }
};
