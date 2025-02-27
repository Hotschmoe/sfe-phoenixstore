import { config } from './utils/config';
import { PhoenixStore } from './core/PhoenixStore';
import { PhoenixApi } from './api/PhoenixApi';
import { MongoAdapter } from './adapters/MongoAdapter';
export * from './types';

// Create and export the default instance
const adapter = new MongoAdapter(config.MONGODB_URI, config.MONGODB_DATABASE);
const defaultStore = new PhoenixStore(adapter);

// Export the PhoenixStore class for custom instances
export { PhoenixStore };
export default defaultStore;

// Start the server if this file is run directly
const isMainModule = process.argv[1] === import.meta.url || process.argv[1]?.endsWith('index.ts');

if (isMainModule) {
  console.log('\n[*] Starting Phoenix Store Server...');
  console.log('----------------------------------------');
  console.log(`[>] Environment: ${config.ENVIRONMENT}`);
  console.log(`[>] MongoDB URI: ${config.MONGODB_URI}`);
  console.log(`[>] Database: ${config.MONGODB_DATABASE}`);
  console.log(`[>] Server Port: ${config.PHOENIXSTORE_PORT}`);
  console.log(`[>] Public URL: ${config.PHOENIXSTORE_PUBLIC_URL}`);

  let server: any = null;

  // Handle shutdown gracefully
  const shutdown = async () => {
    console.log('\n[!] Shutting down gracefully...');
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
    console.error('[X] Uncaught Exception:', error);
    await shutdown();
  });

  try {
    // Initialize store and connect to MongoDB
    console.log('\n[*] Connecting to MongoDB...');
    await defaultStore.connect();
    console.log('[✓] MongoDB connected successfully');
    
    // Create and start API server
    console.log(`\n[*] Starting API server on port ${config.PHOENIXSTORE_PORT}...`);
    const api = new PhoenixApi(defaultStore);
    server = await api.start(config.PHOENIXSTORE_PORT);
    console.log(`[✓] Server is running at ${config.PHOENIXSTORE_PUBLIC_URL}`);

    // Keep the process alive
    process.stdin.resume();
  } catch (error) {
    console.error('\n[X] Failed to start server:', error);
    await shutdown();
  }
} 