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
if (import.meta.url === import.meta.main) {
  // Initialize store and connect to MongoDB
  await defaultStore.connect();
  
  // Create and start API server
  const api = new PhoenixApi(defaultStore);
  api.start(config.PORT);
} 