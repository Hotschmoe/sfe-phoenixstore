import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

interface Config {
  MONGODB_URI: string;
  MONGODB_DATABASE: string;
  PORT: number;
  NODE_ENV: string;
}

// Configuration with validation and defaults
export const config: Config = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/phoenixstore',
  MONGODB_DATABASE: process.env.MONGODB_DATABASE || 'phoenixstore',
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
};
