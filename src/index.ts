import { config } from './utils/config';
import { PhoenixStore } from './core/PhoenixStore';
import { PhoenixApi } from './api/PhoenixApi';
export * from './types';

// Create and export the default instance
const defaultStore = new PhoenixStore(
  config.MONGODB_URI,
  config.MONGODB_DATABASE
);

// Export the PhoenixStore class for custom instances
export { PhoenixStore };
export default defaultStore;

// Start the server if this file is run directly
const isMainModule = process.argv[1] === import.meta.url || process.argv[1]?.endsWith('index.ts');
if (isMainModule) {
  console.log('Starting Phoenix Store Server...');
  console.log('Environment:', config.NODE_ENV);
  console.log('MongoDB URI:', config.MONGODB_URI);
  console.log('Database:', config.MONGODB_DATABASE);
  console.log('Port:', config.PORT);

  let server: any = null;

  // Handle shutdown gracefully
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    if (server) {
      await server.stop();
    }
    await defaultStore.disconnect();
    process.exit(0);
  };

  // Handle errors
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await shutdown();
  });

  try {
    // Initialize store and connect to MongoDB
    console.log('Connecting to MongoDB...');
    await defaultStore.connect();
    console.log('MongoDB connected successfully');
    
    // Create and start API server
    console.log(`Starting API server on port ${config.PORT}...`);
    const api = new PhoenixApi(defaultStore);
    server = await api.start(config.PORT);
    console.log(`Server is running on port ${config.PORT}`);

    // Keep the process alive
    process.stdin.resume();
  } catch (error) {
    console.error('Failed to start server:', error);
    await shutdown();
  }
} 