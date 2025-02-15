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

export interface JWTPayload {
  sub: string; // user id
  email: string;
  displayName?: string;
  customClaims?: Record<string, any>;
  type: 'access' | 'refresh';
}

export type AuthError = 
  | 'EMAIL_EXISTS'
  | 'INVALID_EMAIL'
  | 'INVALID_PASSWORD'
  | 'USER_NOT_FOUND'
  | 'USER_DISABLED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_REVOKED'; 