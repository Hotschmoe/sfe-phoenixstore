import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

interface Config {
  MONGODB_URI: string;
  MONGODB_DATABASE: string;
  MONGODB_USER: string;
  MONGODB_PASSWORD: string;
  MONGODB_HOST: string;
  MONGODB_PORT: string;
  API_URL: string;
  PORT: number;
  // WebSocket Configuration
  WEBSOCKET_PORT: number;
  WEBSOCKET_HEARTBEAT_INTERVAL: number;
  WEBSOCKET_MAX_CLIENTS: number;
  WEBSOCKET_PING_TIMEOUT: number;
  // SMTP Configuration
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM_EMAIL: string;
  SMTP_FROM_NAME: string;
  // Storage Configuration
  STORAGE_ENDPOINT: string;
  STORAGE_PORT: number;
  STORAGE_ACCESS_KEY: string;
  STORAGE_SECRET_KEY: string;
  STORAGE_USE_SSL: boolean;
  STORAGE_REGION: string;
  STORAGE_PUBLIC_URL: string;
  // Default bucket name
  STORAGE_BUCKET: string;
}

// Development defaults - DO NOT use in production
const devDefaults = {
  MONGODB_HOST: 'localhost',
  MONGODB_PORT: '27017',
  MONGODB_DATABASE: 'phoenixstore',
  MONGODB_USER: 'phoenixuser',
  MONGODB_PASSWORD: 'phoenixpass',
  PORT: '3000',
  // WebSocket defaults
  WEBSOCKET_PORT: '3001',
  WEBSOCKET_HEARTBEAT_INTERVAL: '30000',
  WEBSOCKET_MAX_CLIENTS: '10000',
  WEBSOCKET_PING_TIMEOUT: '5000',
  // NODE_ENV: 'development', this should be set by Dockerfile
  API_URL: 'http://localhost:3000',
  // SMTP defaults for development
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'test-user',
  SMTP_PASS: 'test-pass',
  SMTP_FROM_EMAIL: 'noreply@example.com',
  SMTP_FROM_NAME: 'PhoenixStore',
  // Storage defaults for development
  STORAGE_ENDPOINT: 'localhost',
  STORAGE_PORT: '9000',
  STORAGE_ACCESS_KEY: 'minioadmin',
  STORAGE_SECRET_KEY: 'minioadmin',
  STORAGE_USE_SSL: false,
  STORAGE_REGION: 'us-east-1',
  STORAGE_PUBLIC_URL: 'http://localhost:9000'
} as const;

// Helper to build MongoDB URI
const buildMongoUri = (host: string, port: string, user: string, pass: string, db: string) => 
  `mongodb://${user}:${pass}@${host}:${port}/${db}?authSource=admin`;

// Validate production environment
const validateProductionConfig = () => {
  if (process.env.PHOENIXSTORE_ENV === 'production') {
    const missingVars = [];
    if (!process.env.MONGODB_HOST) missingVars.push('MONGODB_HOST');
    if (!process.env.MONGODB_PORT) missingVars.push('MONGODB_PORT');
    if (!process.env.MONGODB_DATABASE) missingVars.push('MONGODB_DATABASE');
    if (!process.env.MONGODB_USER) missingVars.push('MONGODB_USER');
    if (!process.env.MONGODB_PASSWORD) missingVars.push('MONGODB_PASSWORD');
    if (!process.env.PHOENIXSTORE_API_URL) missingVars.push('PHOENIXSTORE_API_URL');
    // SMTP validation
    if (!process.env.SMTP_HOST) missingVars.push('SMTP_HOST');
    if (!process.env.SMTP_PORT) missingVars.push('SMTP_PORT');
    if (!process.env.SMTP_USER) missingVars.push('SMTP_USER');
    if (!process.env.SMTP_PASS) missingVars.push('SMTP_PASS');
    if (!process.env.SMTP_FROM_EMAIL) missingVars.push('SMTP_FROM_EMAIL');
    // Storage validation
    if (!process.env.STORAGE_ENDPOINT) missingVars.push('STORAGE_ENDPOINT');
    if (!process.env.STORAGE_PORT) missingVars.push('STORAGE_PORT');
    if (!process.env.STORAGE_ACCESS_KEY) missingVars.push('STORAGE_ACCESS_KEY');
    if (!process.env.STORAGE_SECRET_KEY) missingVars.push('STORAGE_SECRET_KEY');
    if (!process.env.STORAGE_PUBLIC_URL) missingVars.push('STORAGE_PUBLIC_URL');
    // WebSocket validation
    if (!process.env.WEBSOCKET_PORT) missingVars.push('WEBSOCKET_PORT');
    if (!process.env.WEBSOCKET_HEARTBEAT_INTERVAL) missingVars.push('WEBSOCKET_HEARTBEAT_INTERVAL');
    if (!process.env.WEBSOCKET_MAX_CLIENTS) missingVars.push('WEBSOCKET_MAX_CLIENTS');
    if (!process.env.WEBSOCKET_PING_TIMEOUT) missingVars.push('WEBSOCKET_PING_TIMEOUT');
    
    if (missingVars.length > 0) {
      console.warn(`⚠️  Warning: Missing required environment variables in production: ${missingVars.join(', ')}`);
      console.warn('Using development defaults in production is not recommended!');
    }
  }
};

// Run validation
validateProductionConfig();

// Configuration with validation and defaults
export const config: Config = {
  MONGODB_HOST: process.env.MONGODB_HOST || devDefaults.MONGODB_HOST,
  MONGODB_PORT: process.env.MONGODB_PORT || devDefaults.MONGODB_PORT,
  MONGODB_DATABASE: process.env.MONGODB_DATABASE || devDefaults.MONGODB_DATABASE,
  MONGODB_USER: process.env.MONGODB_USER || devDefaults.MONGODB_USER,
  MONGODB_PASSWORD: process.env.MONGODB_PASSWORD || devDefaults.MONGODB_PASSWORD,
  MONGODB_URI: process.env.MONGODB_URI || buildMongoUri(
    process.env.MONGODB_HOST || devDefaults.MONGODB_HOST,
    process.env.MONGODB_PORT || devDefaults.MONGODB_PORT,
    process.env.MONGODB_USER || devDefaults.MONGODB_USER,
    process.env.MONGODB_PASSWORD || devDefaults.MONGODB_PASSWORD,
    process.env.MONGODB_DATABASE || devDefaults.MONGODB_DATABASE
  ),
  API_URL: process.env.PHOENIXSTORE_API_URL ? `${process.env.PHOENIXSTORE_API_URL}:${process.env.PHOENIXSTORE_PORT}` : devDefaults.API_URL,
  PORT: parseInt(process.env.PHOENIXSTORE_PORT || devDefaults.PORT, 10),
  // NODE_ENV: process.env.PHOENIXSTORE_ENV || devDefaults.NODE_ENV, // this should be set by Dockerfile
  // WebSocket Configuration
  WEBSOCKET_PORT: parseInt(process.env.WEBSOCKET_PORT || devDefaults.WEBSOCKET_PORT, 10),
  WEBSOCKET_HEARTBEAT_INTERVAL: parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL || devDefaults.WEBSOCKET_HEARTBEAT_INTERVAL, 10),
  WEBSOCKET_MAX_CLIENTS: parseInt(process.env.WEBSOCKET_MAX_CLIENTS || devDefaults.WEBSOCKET_MAX_CLIENTS, 10),
  WEBSOCKET_PING_TIMEOUT: parseInt(process.env.WEBSOCKET_PING_TIMEOUT || devDefaults.WEBSOCKET_PING_TIMEOUT, 10),
  // SMTP Configuration
  SMTP_HOST: process.env.SMTP_HOST || devDefaults.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || devDefaults.SMTP_PORT, 10),
  SMTP_USER: process.env.SMTP_USER || devDefaults.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS || devDefaults.SMTP_PASS,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || devDefaults.SMTP_FROM_EMAIL,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || devDefaults.SMTP_FROM_NAME,
  // Storage Configuration
  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT || devDefaults.STORAGE_ENDPOINT,
  STORAGE_PORT: parseInt(process.env.STORAGE_PORT || devDefaults.STORAGE_PORT, 10),
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY || devDefaults.STORAGE_ACCESS_KEY,
  STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY || devDefaults.STORAGE_SECRET_KEY,
  STORAGE_USE_SSL: process.env.STORAGE_USE_SSL === 'true',
  STORAGE_REGION: process.env.STORAGE_REGION || devDefaults.STORAGE_REGION,
  STORAGE_PUBLIC_URL: process.env.STORAGE_PUBLIC_URL || devDefaults.STORAGE_PUBLIC_URL,
  // Default bucket name
  STORAGE_BUCKET: 'phoenixstore'
};
