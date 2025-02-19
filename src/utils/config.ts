import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

interface Config {
  // Environment
  ENVIRONMENT: string;

  // MongoDB Configuration
  MONGODB_URI: string;
  MONGODB_DATABASE: string;
  MONGODB_USER: string;
  MONGODB_PASSWORD: string;
  MONGODB_PROTOCOL: string;
  MONGODB_HOST: string;
  MONGODB_PORT: string;

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
  WEBSOCKET_HEARTBEAT_INTERVAL: number;
  WEBSOCKET_MAX_CLIENTS: number;
  WEBSOCKET_PING_TIMEOUT: number;

  // Mongo Express Configuration
  MONGOEXPRESS_PROTOCOL: string;
  MONGOEXPRESS_HOST: string;
  MONGOEXPRESS_PORT: number;
  MONGOEXPRESS_PUBLIC_URL: string;
  MONGOEXPRESS_ADMIN_USERNAME: string;
  MONGOEXPRESS_ADMIN_PASSWORD: string;

  // JWT Configuration
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;

  // SMTP Configuration
  SMTP_PROTOCOL: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  SMTP_FROM_EMAIL: string;
  SMTP_FROM_NAME: string;

  // Storage Configuration (MinIO)
  STORAGE_PROTOCOL: string;
  STORAGE_HOST: string;
  STORAGE_PORT: number;
  STORAGE_PUBLIC_URL: string;
  STORAGE_CONSOLE_PORT: number;
  STORAGE_CONSOLE_URL: string;
  STORAGE_ACCESS_KEY: string;
  STORAGE_SECRET_KEY: string;
  STORAGE_USE_SSL: boolean;
  STORAGE_REGION: string;
  STORAGE_BUCKET: string;
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

// Helper to build MongoDB URI
const buildMongoUri = (
  protocol: string,
  host: string,
  port: string,
  user: string,
  password: string,
  database: string
): string => {
  return `${protocol}://${user}:${password}@${host}:${port}/${database}?authSource=admin`;
};

// Validate required environment variables and throw errors if missing
const validateConfig = (): void => {
  const requiredVars: { [key: string]: string } = {
    // Environment
    ENVIRONMENT: process.env.ENVIRONMENT || '',

    // MongoDB
    MONGODB_PROTOCOL: process.env.MONGODB_PROTOCOL || '',
    MONGODB_HOST: process.env.MONGODB_HOST || '',
    MONGODB_PORT: process.env.MONGODB_PORT || '',
    MONGODB_DATABASE: process.env.MONGODB_DATABASE || '',
    MONGODB_USER: process.env.MONGODB_USER || '',
    MONGODB_PASSWORD: process.env.MONGODB_PASSWORD || '',

    // PhoenixStore Server
    PHOENIXSTORE_PROTOCOL: process.env.PHOENIXSTORE_PROTOCOL || '',
    PHOENIXSTORE_HOST: process.env.PHOENIXSTORE_HOST || '',
    PHOENIXSTORE_PORT: process.env.PHOENIXSTORE_PORT || '',

    // WebSocket
    WEBSOCKET_PROTOCOL: process.env.WEBSOCKET_PROTOCOL || '',
    WEBSOCKET_HOST: process.env.WEBSOCKET_HOST || '',
    WEBSOCKET_PORT: process.env.WEBSOCKET_PORT || '',
    WEBSOCKET_HEARTBEAT_INTERVAL: process.env.WEBSOCKET_HEARTBEAT_INTERVAL || '',
    WEBSOCKET_MAX_CLIENTS: process.env.WEBSOCKET_MAX_CLIENTS || '',
    WEBSOCKET_PING_TIMEOUT: process.env.WEBSOCKET_PING_TIMEOUT || '',

    // Mongo Express (optional, so not strictly required)
    MONGOEXPRESS_PROTOCOL: process.env.MONGOEXPRESS_PROTOCOL || '',
    MONGOEXPRESS_HOST: process.env.MONGOEXPRESS_HOST || '',
    MONGOEXPRESS_PORT: process.env.MONGOEXPRESS_PORT || '',
    MONGOEXPRESS_ADMIN_USERNAME: process.env.MONGOEXPRESS_ADMIN_USERNAME || '',
    MONGOEXPRESS_ADMIN_PASSWORD: process.env.MONGOEXPRESS_ADMIN_PASSWORD || '',

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || '',
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '',

    // SMTP
    SMTP_PROTOCOL: process.env.SMTP_PROTOCOL || '',
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: process.env.SMTP_PORT || '',
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || '',
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || '',

    // Storage (MinIO)
    STORAGE_PROTOCOL: process.env.STORAGE_PROTOCOL || '',
    STORAGE_HOST: process.env.STORAGE_HOST || '',
    STORAGE_PORT: process.env.STORAGE_PORT || '',
    STORAGE_CONSOLE_PORT: process.env.STORAGE_CONSOLE_PORT || '',
    STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY || '',
    STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY || '',
    STORAGE_USE_SSL: process.env.STORAGE_USE_SSL || '',
    STORAGE_REGION: process.env.STORAGE_REGION || '',
    STORAGE_BUCKET: process.env.STORAGE_BUCKET || '',
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('\n[*] Environment Variables Validation Failed:');
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

  console.log('\n[*] Environment Variables Status:');
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

  // MongoDB Configuration
  MONGODB_PROTOCOL: process.env.MONGODB_PROTOCOL!,
  MONGODB_HOST: process.env.MONGODB_HOST!,
  MONGODB_PORT: process.env.MONGODB_PORT!,
  MONGODB_DATABASE: process.env.MONGODB_DATABASE!,
  MONGODB_USER: process.env.MONGODB_USER!,
  MONGODB_PASSWORD: process.env.MONGODB_PASSWORD!,
  MONGODB_URI: process.env.MONGODB_URI || buildMongoUri(
    process.env.MONGODB_PROTOCOL!,
    process.env.MONGODB_HOST!,
    process.env.MONGODB_PORT!,
    process.env.MONGODB_USER!,
    process.env.MONGODB_PASSWORD!,
    process.env.MONGODB_DATABASE!
  ),

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
  WEBSOCKET_HEARTBEAT_INTERVAL: parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL!, 10),
  WEBSOCKET_MAX_CLIENTS: parseInt(process.env.WEBSOCKET_MAX_CLIENTS!, 10),
  WEBSOCKET_PING_TIMEOUT: parseInt(process.env.WEBSOCKET_PING_TIMEOUT!, 10),

  // Mongo Express Configuration
  MONGOEXPRESS_PROTOCOL: process.env.MONGOEXPRESS_PROTOCOL!,
  MONGOEXPRESS_HOST: process.env.MONGOEXPRESS_HOST!,
  MONGOEXPRESS_PORT: parseInt(process.env.MONGOEXPRESS_PORT!, 10),
  MONGOEXPRESS_PUBLIC_URL: buildUrl(
    process.env.MONGOEXPRESS_PROTOCOL!,
    process.env.MONGOEXPRESS_PUBLIC_HOST!,
    process.env.MONGOEXPRESS_PUBLIC_PORT!
  ),
  MONGOEXPRESS_ADMIN_USERNAME: process.env.MONGOEXPRESS_ADMIN_USERNAME!,
  MONGOEXPRESS_ADMIN_PASSWORD: process.env.MONGOEXPRESS_ADMIN_PASSWORD!,

  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN!,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN!,

  // SMTP Configuration
  SMTP_PROTOCOL: process.env.SMTP_PROTOCOL!,
  SMTP_HOST: process.env.SMTP_HOST!,
  SMTP_PORT: parseInt(process.env.SMTP_PORT!, 10),
  SMTP_USER: process.env.SMTP_USER!,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD!,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL!,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME!,

  // Storage Configuration (MinIO)
  STORAGE_PROTOCOL: process.env.STORAGE_PROTOCOL!,
  STORAGE_HOST: process.env.STORAGE_HOST!,
  STORAGE_PORT: parseInt(process.env.STORAGE_PORT!, 10),
  STORAGE_PUBLIC_URL: buildUrl(
    process.env.STORAGE_PUBLIC_PROTOCOL!,
    process.env.STORAGE_PUBLIC_HOST!,
    process.env.STORAGE_PUBLIC_PORT!
  ),
  STORAGE_CONSOLE_PORT: parseInt(process.env.STORAGE_CONSOLE_PORT!, 10),
  STORAGE_CONSOLE_URL: buildUrl(
    process.env.STORAGE_PUBLIC_PROTOCOL!,
    process.env.STORAGE_PUBLIC_HOST!,
    process.env.STORAGE_CONSOLE_PORT!
  ),
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY!,
  STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY!,
  STORAGE_USE_SSL: process.env.STORAGE_USE_SSL === 'true',
  STORAGE_REGION: process.env.STORAGE_REGION!,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET!,
};