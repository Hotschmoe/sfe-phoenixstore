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
  NODE_ENV: string;
}

// Development defaults - DO NOT use in production
const devDefaults = {
  MONGODB_HOST: 'localhost',
  MONGODB_PORT: '27017',
  MONGODB_DATABASE: 'phoenixstore',
  MONGODB_USER: 'phoenixuser',
  MONGODB_PASSWORD: 'phoenixpass',
  PORT: '3000',
  NODE_ENV: 'development',
  API_URL: 'http://localhost:3000'
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
  NODE_ENV: process.env.PHOENIXSTORE_ENV || devDefaults.NODE_ENV,
};
