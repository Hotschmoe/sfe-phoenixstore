import { MongoClient } from 'mongodb';
import { config } from '../utils/config';

// Test database name will be the main database name with a '_test' suffix
const TEST_DB_NAME = `${config.MONGODB_DATABASE}_test`;

export const getTestDbUri = () => {
  // Parse the existing URI to maintain authentication
  const currentUri = new URL(config.MONGODB_URI);
  
  // Create new URI with test database
  const testUri = new URL(currentUri.toString());
  testUri.pathname = `/${TEST_DB_NAME}`;
  
  return testUri.toString();
};

export const cleanupDatabase = async () => {
  const client = new MongoClient(getTestDbUri());
  try {
    await client.connect();
    const db = client.db(TEST_DB_NAME);
    // Drop all collections
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      await db.collection(collection.name).drop().catch(() => {
        // Ignore errors if collection doesn't exist
      });
    }
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
  } finally {
    await client.close();
  }
};

// Run before all tests
export const setup = async () => {
  // Ensure we're using test database
  if (!process.env.MONGODB_URI?.includes('test')) {
    console.log('Setting up test database...');
    await cleanupDatabase();
  }
};

// Run after all tests
export const teardown = async () => {
  console.log('Cleaning up test database...');
  await cleanupDatabase();
};
