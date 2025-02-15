import { SignJWT, jwtVerify } from 'jose';
import { JWTPayload } from '../types/auth';
import { PhoenixStoreError } from '../types';

const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new PhoenixStoreError(
    'JWT_SECRET environment variable is not set',
    'CONFIGURATION_ERROR'
  );
}

// Convert the JWT_SECRET to Uint8Array for jose
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function generateAccessToken(payload: Omit<JWTPayload, 'type'>): Promise<string> {
  const token = await new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_ACCESS_EXPIRES_IN)
    .sign(secretKey);
  
  return token;
}

export async function generateRefreshToken(payload: Omit<JWTPayload, 'type'>): Promise<string> {
  const token = await new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_REFRESH_EXPIRES_IN)
    .sign(secretKey);
  
  return token;
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as JWTPayload;
  } catch (error) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new PhoenixStoreError('Token has expired', 'TOKEN_EXPIRED');
    }
    throw new PhoenixStoreError('Invalid token', 'INVALID_TOKEN');
  }
}

export async function generateAuthTokens(payload: Omit<JWTPayload, 'type'>): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);

  // Parse duration string to milliseconds (e.g., '15m' to milliseconds)
  const expiresIn = parseDuration(JWT_ACCESS_EXPIRES_IN);

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

// Helper function to parse duration strings like '15m', '1h', '7d' to milliseconds
function parseDuration(duration: string): number {
  const unit = duration.slice(-1);
  const value = parseInt(duration.slice(0, -1));

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new PhoenixStoreError(
        'Invalid duration format in JWT expiration configuration',
        'CONFIGURATION_ERROR'
      );
  }
} 