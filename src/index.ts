import { config } from './utils/config';
import { PhoenixStore } from './core/PhoenixStore';
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
  const server = Bun.serve({
    port: config.PORT,
    fetch(req) {
      return new Response("PhoenixStore is running!");
    },
  });

  console.log(`🚀 Server running at http://localhost:${server.port}`);
} 