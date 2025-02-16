import { DocumentData } from './index';

export interface PhoenixUser extends DocumentData {
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  displayName?: string;
  photoURL?: string;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
  customClaims?: Record<string, any>;
}

export interface CreateUserParams {
  email: string;
  password: string;
  displayName?: string;
  photoURL?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenParams {
  refreshToken: string;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  displayName?: string;
  customClaims?: Record<string, any>;
  type: 'access' | 'refresh';
  jti?: string; // JWT ID for revocation
}

export type AuthError = 
  | 'EMAIL_EXISTS'
  | 'INVALID_EMAIL'
  | 'INVALID_PASSWORD'
  | 'USER_NOT_FOUND'
  | 'USER_DISABLED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_REVOKED'
  | 'INVALID_REFRESH_TOKEN'
  | 'TOKEN_BLACKLISTED';

// Token blacklist entry
export interface TokenBlacklist extends DocumentData {
  token: string;     // Hashed token value
  expiresAt: number; // Timestamp when token expires
  revokedAt: number; // Timestamp when token was revoked
  userId: string;    // User who owned the token
  type: 'access' | 'refresh'; // Type of token
} 