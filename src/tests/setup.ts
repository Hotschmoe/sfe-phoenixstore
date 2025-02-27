import { MongoClient } from 'mongodb';
import { config } from '../utils/config';
import { WebSocketManagerConfig } from '../core/WebSocketManager';

// Test database name will be the main database name with a '_test' suffix
const TEST_DB_NAME = `${config.MONGODB_DATABASE}_test`;

interface TestConfig {
  mongodb: {
    protocol: string;
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
    uri: string;
  };
  websocket: {
    protocol: string;
    host: string;
    port: number;
    heartbeatInterval: number;
    maxClients: number;
    pingTimeout: number;
    pollingInterval: number;
  };
  storage: {
    protocol: string;
    host: string;
    port: number;
    consolePort: number;
    accessKey: string;
    secretKey: string;
    useSSL: boolean;
    region: string;
    bucket: string;
    publicUrl: string;
    consoleUrl: string;
  };
}

// For tests, we always want to use localhost since tests run outside Docker
export const TEST_CONFIG: TestConfig = {
  mongodb: {
    protocol: config.MONGODB_PROTOCOL,
    host: 'localhost', // Always use localhost for tests
    port: config.MONGODB_PORT,
    user: config.MONGODB_USER,
    password: config.MONGODB_PASSWORD,
    database: TEST_DB_NAME,
    uri: `${config.MONGODB_PROTOCOL}://${config.MONGODB_USER}:${config.MONGODB_PASSWORD}@localhost:${config.MONGODB_PORT}/${TEST_DB_NAME}?authSource=admin`
  },
  websocket: {
    protocol: config.WEBSOCKET_PROTOCOL,
    host: 'localhost', // Always use localhost for tests
    port: 3002, // Use a different port for tests to avoid conflicts
    heartbeatInterval: config.WEBSOCKET_HEARTBEAT_INTERVAL,
    maxClients: config.WEBSOCKET_MAX_CLIENTS,
    pingTimeout: config.WEBSOCKET_PING_TIMEOUT,
    pollingInterval: 500 // Faster polling for tests
  },
  storage: {
    protocol: config.STORAGE_PROTOCOL,
    host: 'localhost', // Always use localhost for tests
    port: config.STORAGE_PORT,
    consolePort: config.STORAGE_CONSOLE_PORT,
    accessKey: config.STORAGE_ACCESS_KEY,
    secretKey: config.STORAGE_SECRET_KEY,
    useSSL: config.STORAGE_USE_SSL,
    region: config.STORAGE_REGION,
    // We are only creating one bucket in docker-compose.yml
    // For testing purposes, we can append _test to item names
    // or create a test directory in the phoenixstore bucket
    bucket: config.STORAGE_BUCKET,
    publicUrl: `${config.STORAGE_PROTOCOL}://localhost:${config.STORAGE_PORT}`,
    consoleUrl: `${config.STORAGE_PROTOCOL}://localhost:${config.STORAGE_CONSOLE_PORT}`
  }
};

export const getTestDbUri = () => {
  return TEST_CONFIG.mongodb.uri;
};

export const getTestWebSocketConfig = (): Required<WebSocketManagerConfig> => ({
  heartbeatInterval: TEST_CONFIG.websocket.heartbeatInterval,
  maxClients: TEST_CONFIG.websocket.maxClients,
  pingTimeout: TEST_CONFIG.websocket.pingTimeout,
  pollingInterval: TEST_CONFIG.websocket.pollingInterval
});

export const cleanupDatabase = async () => {
  console.log('\n[*] Setting up test database...');
  const client = new MongoClient(getTestDbUri());
  
  try {
    await client.connect();
    console.log('[✓] Connected to MongoDB');
    
    const db = client.db(TEST_DB_NAME);
    console.log('[*] Cleaning up test database...');
    
    // Drop all collections
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      try {
        await db.collection(collection.name).drop();
        console.log(`[✓] Dropped collection: ${collection.name}`);
      } catch (error) {
        console.log(`[!] Error dropping collection ${collection.name}:`, error);
      }
    }
  } catch (error) {
    console.error('[X] Failed to cleanup test database:', error);
    throw error; // Re-throw to fail the test setup
  } finally {
    await client.close();
    console.log('[✓] Closed MongoDB connection');
  }
};

// Run before all tests
export const setup = async () => {
  try {
    console.log('\n[*] Setting up test environment...');
    console.log('----------------------------------------');
    console.log(`[>] Environment: ${config.ENVIRONMENT}`);
    console.log('\n[*] MongoDB Configuration:');
    console.log(`[>] Test Database: ${TEST_DB_NAME}`);
    console.log(`[>] MongoDB URI: ${TEST_CONFIG.mongodb.uri}`);
    console.log('\n[*] WebSocket Configuration:');
    console.log(`[>] WebSocket Port: ${TEST_CONFIG.websocket.port}`);
    console.log(`[>] WebSocket URL: ${TEST_CONFIG.websocket.protocol}://${TEST_CONFIG.websocket.host}:${TEST_CONFIG.websocket.port}`);
    console.log('\n[*] Storage Configuration:');
    console.log(`[>] Storage Bucket: ${TEST_CONFIG.storage.bucket}`);
    console.log(`[>] Storage URL: ${TEST_CONFIG.storage.publicUrl}`);
    console.log(`[>] Console URL: ${TEST_CONFIG.storage.consoleUrl}`);
    
    await cleanupDatabase();
    console.log('[✓] Test environment setup complete\n');
  } catch (error) {
    console.error('\n[X] Test setup failed:', error);
    process.exit(1); // Exit if we can't set up the test environment
  }
};

// Run after all tests
export const teardown = async () => {
  try {
    console.log('\n[*] Cleaning up test environment...');
    await cleanupDatabase();
    console.log('[✓] Test environment cleanup complete\n');
  } catch (error) {
    console.error('\n[X] Test teardown failed:', error);
  }
};
