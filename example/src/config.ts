import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

interface Config {
  // Environment
  ENVIRONMENT: string;

  // PhoenixStore Server Configuration (API)
  PHOENIXSTORE_PROTOCOL: string;
  PHOENIXSTORE_HOST: string;
  PHOENIXSTORE_PORT: number;
  PHOENIXSTORE_PUBLIC_URL: string;

  // WebSocket Configuration
  WEBSOCKET_PROTOCOL: string;
  WEBSOCKET_HOST: string;
  WEBSOCKET_PORT: number;
  WEBSOCKET_PUBLIC_URL: string;

  // Storage Configuration (MinIO)
  STORAGE_PUBLIC_PROTOCOL: string;
  STORAGE_PUBLIC_HOST: string;
  STORAGE_PUBLIC_PORT: number;
  STORAGE_PUBLIC_URL: string;
}


// Utility to build URLs consistently
const buildUrl = (protocol: string, host: string, port: string | number): string => {
    if (!protocol || !host) {
      throw new Error('Protocol and host are required for URL construction');
    }
    const portStr = String(port);
    if ((portStr === '80' && protocol === 'http') || (portStr === '443' && protocol === 'https')) {
      return `${protocol}://${host}`;
    }
    return `${protocol}://${host}:${portStr}`;
  };

  // Validate required environment variables and throw errors if missing
const validateConfig = (): void => {
    const requiredVars: { [key: string]: string } = {
      // Environment
      ENVIRONMENT: process.env.ENVIRONMENT || '',
  
      // PhoenixStore Server
      PHOENIXSTORE_PROTOCOL: process.env.PHOENIXSTORE_PROTOCOL || '',
      PHOENIXSTORE_HOST: process.env.PHOENIXSTORE_HOST || '',
      PHOENIXSTORE_PORT: process.env.PHOENIXSTORE_PORT || '',
      PHOENIXSTORE_PUBLIC_HOST: process.env.PHOENIXSTORE_PUBLIC_HOST || '',
      PHOENIXSTORE_PUBLIC_PORT: process.env.PHOENIXSTORE_PUBLIC_PORT || '',
  
      // WebSocket
      WEBSOCKET_PROTOCOL: process.env.WEBSOCKET_PROTOCOL || '',
      WEBSOCKET_HOST: process.env.WEBSOCKET_HOST || '',
      WEBSOCKET_PORT: process.env.WEBSOCKET_PORT || '',
      WEBSOCKET_PUBLIC_HOST: process.env.WEBSOCKET_PUBLIC_HOST || '',
      WEBSOCKET_PUBLIC_PORT: process.env.WEBSOCKET_PUBLIC_PORT || '',

      // Storage
      STORAGE_PUBLIC_PROTOCOL: process.env.STORAGE_PUBLIC_PROTOCOL || '',
      STORAGE_PUBLIC_HOST: process.env.STORAGE_PUBLIC_HOST || '',
      STORAGE_PUBLIC_PORT: process.env.STORAGE_PUBLIC_PORT || '',
    };
  
    const missingVars = Object.entries(requiredVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);
  
    if (missingVars.length > 0) {
      console.error('\n[*] Frontend Environment Variables Validation Failed:');
      console.error('------------------------------------------');
      console.error(`[>] Environment: ${process.env.ENVIRONMENT || 'unknown'}`);
      console.error('[!] The following required environment variables are missing or empty:');
      missingVars.forEach((variable) => {
        console.error(`    - ${variable}`);
      });
      throw new Error(
        `Configuration validation failed: ${missingVars.length} required environment variable(s) missing`
      );
    }
  
    console.log('\n[*] Frontend Environment Variables Status:');
    console.log('--------------------------------');
    console.log(`[>] Environment: ${process.env.ENVIRONMENT}`);
    console.log('[✓] All required environment variables are set\n');
  };
  
  // Run validation at startup
  validateConfig();
  
  // Export the configuration object
  export const config: Config = {
    // Environment
    ENVIRONMENT: process.env.ENVIRONMENT!,
  
    // PhoenixStore Server Configuration (API)
    PHOENIXSTORE_PROTOCOL: process.env.PHOENIXSTORE_PROTOCOL!,
    PHOENIXSTORE_HOST: process.env.PHOENIXSTORE_HOST!,
    PHOENIXSTORE_PORT: parseInt(process.env.PHOENIXSTORE_PORT!, 10),
    PHOENIXSTORE_PUBLIC_URL: buildUrl(
      process.env.PHOENIXSTORE_PROTOCOL!,
      process.env.PHOENIXSTORE_PUBLIC_HOST!,
      process.env.PHOENIXSTORE_PUBLIC_PORT!
    ),
  
    // WebSocket Configuration
    WEBSOCKET_PROTOCOL: process.env.WEBSOCKET_PROTOCOL!,
    WEBSOCKET_HOST: process.env.WEBSOCKET_HOST!,
    WEBSOCKET_PORT: parseInt(process.env.WEBSOCKET_PORT!, 10),
    WEBSOCKET_PUBLIC_URL: buildUrl(
      process.env.WEBSOCKET_PROTOCOL!,
      process.env.WEBSOCKET_PUBLIC_HOST!,
      process.env.WEBSOCKET_PUBLIC_PORT!
    ),

    // Storage Configuration (MinIO)
    STORAGE_PUBLIC_PROTOCOL: process.env.STORAGE_PUBLIC_PROTOCOL!,
    STORAGE_PUBLIC_HOST: process.env.STORAGE_PUBLIC_HOST!,
    STORAGE_PUBLIC_PORT: parseInt(process.env.STORAGE_PUBLIC_PORT!, 10),
    STORAGE_PUBLIC_URL: buildUrl(
      process.env.STORAGE_PUBLIC_PROTOCOL!,
      process.env.STORAGE_PUBLIC_HOST!,
      process.env.STORAGE_PUBLIC_PORT!
    ),
  };