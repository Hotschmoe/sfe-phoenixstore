import { MongoClient } from 'mongodb';
import { config } from '../utils/config';

// Test database name will be the main database name with a '_test' suffix
const TEST_DB_NAME = `${config.MONGODB_DATABASE}_test`;

// For tests, we always want to use localhost since tests run outside Docker
const TEST_CONFIG = {
  mongodb: {
    host: 'localhost',
    port: config.MONGODB_PORT,
    user: config.MONGODB_USER,
    password: config.MONGODB_PASSWORD
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
