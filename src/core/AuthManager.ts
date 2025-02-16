import { MongoAdapter } from '../adapters/MongoAdapter';
import { CreateUserParams, PhoenixUser, SignInParams, AuthTokens, RefreshTokenParams, TokenBlacklist, JWTPayload } from '../types/auth';
import { PhoenixStoreError } from '../types';
import { generateAuthTokens, verifyToken, getExpirationFromDuration } from '../utils/jwt';
import { createHash } from 'crypto';
import { generateVerificationEmail, generatePasswordResetEmail, sendEmail } from '../utils/email';
import { randomBytes } from 'crypto';

interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

export class AuthManager {
  private readonly USERS_COLLECTION = 'users';
  private readonly BLACKLIST_COLLECTION = 'token_blacklist';
  private readonly MAX_EMAIL_LENGTH = 254; // RFC 5321
  private readonly MIN_PASSWORD_LENGTH = 8;
  private readonly MAX_PASSWORD_LENGTH = 128; // Reasonable upper limit
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

  constructor(private readonly db: MongoAdapter) {}

  async createUser(params: CreateUserParams): Promise<PhoenixUser> {
    // Validate email
    const emailValidation = this.validateEmail(params.email);
    if (!emailValidation.isValid) {
      throw new PhoenixStoreError(emailValidation.error || 'Invalid email', 'INVALID_EMAIL');
    }

    // Validate password
    const passwordValidation = this.validatePassword(params.password);
    if (!passwordValidation.isValid) {
      throw new PhoenixStoreError(
        `Password validation failed: ${passwordValidation.errors.join(', ')}`,
        'INVALID_PASSWORD'
      );
    }

    // Check if email already exists
    const existingUser = await this.db.query<PhoenixUser>(this.USERS_COLLECTION, [
      { field: 'email', operator: '==', value: params.email.toLowerCase() }
    ]);

    if (existingUser.length > 0) {
      throw new PhoenixStoreError('Email already exists', 'EMAIL_EXISTS');
    }

    // Hash password using Bun's built-in crypto
    const passwordHash = await this.hashPassword(params.password);

    // Create user document
    const now = new Date().toISOString();
    const userData: Omit<PhoenixUser, 'id'> = {
      email: params.email.toLowerCase(),
      emailVerified: false,
      passwordHash,
      displayName: params.displayName || null,
      photoURL: params.photoURL || null,
      disabled: false,
      failedLoginAttempts: 0,
      lastFailedLogin: null,
      metadata: {
        creationTime: now,
        lastSignInTime: now
      }
    };

    // Add user to database
    const userId = await this.db.add(this.USERS_COLLECTION, userData);
    if (!userId) {
      throw new PhoenixStoreError('Failed to create user', 'DATABASE_ERROR');
    }

    return { ...userData, id: userId } as PhoenixUser;
  }

  async signIn(params: SignInParams): Promise<AuthTokens> {
    // Validate email format before querying
    const emailValidation = this.validateEmail(params.email);
    if (!emailValidation.isValid) {
      throw new PhoenixStoreError(emailValidation.error || 'Invalid email', 'INVALID_EMAIL');
    }

    // Find user by email
    const users = await this.db.query<PhoenixUser>(this.USERS_COLLECTION, [
      { field: 'email', operator: '==', value: params.email.toLowerCase() }
    ]);

    if (users.length === 0) {
      throw new PhoenixStoreError('User not found', 'USER_NOT_FOUND');
    }

    const user = users[0];
    if (!user || !user.id) {
      throw new PhoenixStoreError('Invalid user data', 'DATABASE_ERROR');
    }

    // Check if user is disabled
    if (user.disabled) {
      throw new PhoenixStoreError('User account is disabled', 'USER_DISABLED');
    }

    // Check for account lockout
    if (this.isAccountLocked(user)) {
      const remainingLockTime = Math.ceil((user.lastFailedLogin! + this.LOCKOUT_DURATION - Date.now()) / 1000);
      throw new PhoenixStoreError(
        `Account temporarily locked. Try again in ${remainingLockTime} seconds`,
        'ACCOUNT_LOCKED'
      );
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(params.password, user.passwordHash);
    if (!isValidPassword) {
      await this.updateFailedAttempts(user);
      throw new PhoenixStoreError('Invalid password', 'INVALID_PASSWORD');
    }

    // Reset failed login attempts on successful login
    await this.db.update(this.USERS_COLLECTION, user.id, {
      failedLoginAttempts: 0,
      lastFailedLogin: null,
      'metadata.lastSignInTime': new Date().toISOString()
    });

    // Generate tokens
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      ...(user.displayName && { displayName: user.displayName }),
      ...(user.customClaims && { customClaims: user.customClaims })
    };

    const tokens = await generateAuthTokens(tokenPayload);
    return tokens;
  }

  async refreshToken(params: RefreshTokenParams): Promise<AuthTokens> {
    // Verify the refresh token
    const payload = await verifyToken(params.refreshToken, 'refresh');
    
    // Check if token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(params.refreshToken);
    if (isBlacklisted) {
      throw new PhoenixStoreError('Token has been revoked', 'TOKEN_REVOKED');
    }

    // Get user to verify they still exist and are not disabled
    const users = await this.db.query<PhoenixUser>(this.USERS_COLLECTION, [
      { field: 'email', operator: '==', value: payload.email }
    ]);

    if (users.length === 0) {
      throw new PhoenixStoreError('User not found', 'USER_NOT_FOUND');
    }

    const user = users[0];
    if (user.disabled) {
      throw new PhoenixStoreError('User account is disabled', 'USER_DISABLED');
    }

    // Generate new tokens
    const tokenPayload = {
      sub: user.id!,
      email: user.email,
      ...(user.displayName && { displayName: user.displayName }),
      ...(user.customClaims && { customClaims: user.customClaims })
    };

    // Blacklist the old refresh token
    await this.blacklistToken(params.refreshToken, user.id!, 'refresh');

    // Generate new tokens
    return await generateAuthTokens(tokenPayload);
  }

  async verifyToken(token: string, type: 'access' | 'refresh'): Promise<JWTPayload> {
    // Check blacklist first
    const isBlacklisted = await this.isTokenBlacklisted(token);
    
    if (isBlacklisted) {
      throw new PhoenixStoreError('Token has been revoked', 'TOKEN_REVOKED');
    }

    // Then verify token validity
    return await verifyToken(token, type);
  }

  async revokeToken(token: string, type: 'access' | 'refresh'): Promise<void> {
    try {
      // Extract payload without blacklist check
      const payload = await verifyToken(token, type);
      
      // Blacklist the token
      await this.blacklistToken(token, payload.sub, type);
    } catch (error) {
      if (error instanceof PhoenixStoreError && error.code === 'TOKEN_EXPIRED') {
        // For expired tokens, still try to blacklist them
        try {
          const payload = await verifyToken(token, type);
          await this.blacklistToken(token, payload.sub, type);
        } catch {
          throw new PhoenixStoreError('Invalid token', 'INVALID_TOKEN');
        }
      } else {
        throw new PhoenixStoreError('Invalid token', 'INVALID_TOKEN');
      }
    }
  }

  private isAccountLocked(user: PhoenixUser): boolean {
    if (!user.failedLoginAttempts || !user.lastFailedLogin) {
      return false;
    }

    if (user.failedLoginAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockoutEndTime = user.lastFailedLogin + this.LOCKOUT_DURATION;
      if (Date.now() < lockoutEndTime) {
        return true;
      }
      // If lockout has expired, reset the counters
      user.failedLoginAttempts = 0;
      user.lastFailedLogin = null;
    }

    return false;
  }

  private async hashPassword(password: string): Promise<string> {
    return await Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: 10
    });
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await Bun.password.verify(password, hash);
  }

  private validateEmail(email: string): EmailValidationResult {
    if (!email) {
      return { isValid: false, error: 'Email is required' };
    }

    if (email.length > this.MAX_EMAIL_LENGTH) {
      return { isValid: false, error: 'Email is too long' };
    }

    // Check for @ symbol first
    if (!email.includes('@')) {
      return { isValid: false, error: 'Invalid email format' };
    }

    // Domain check before full format check
    const [, domain] = email.split('@');
    if (!domain) {
      return { isValid: false, error: 'Invalid email domain' };
    }
    if (!domain.includes('.')) {
      return { isValid: false, error: 'Invalid email domain' };
    }

    // Full RFC 5322 validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    return { isValid: true };
  }

  private validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password) {
      return { isValid: false, errors: ['Password is required'] };
    }

    if (password.length < this.MIN_PASSWORD_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters long`);
    }

    if (password.length > this.MAX_PASSWORD_LENGTH) {
      errors.push(`Password must not exceed ${this.MAX_PASSWORD_LENGTH} characters`);
    }

    // Only check other criteria if length requirements are met
    if (errors.length === 0) {
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }

      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }

      if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
      }

      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }

      // Only check for repeated characters if all other criteria are met
      if (errors.length === 0 && /(.)\1{2,}/.test(password)) {
        errors.push('Password should not contain repeated characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async updateFailedAttempts(user: PhoenixUser): Promise<void> {
    if (!user.id) return;

    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const lastFailedLogin = Date.now();

    await this.db.update(this.USERS_COLLECTION, user.id, {
      failedLoginAttempts: failedAttempts,
      lastFailedLogin
    });

    // Update the user object to reflect the changes
    user.failedLoginAttempts = failedAttempts;
    user.lastFailedLogin = lastFailedLogin;

    // Check if this update triggered a lockout
    if (failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      throw new PhoenixStoreError(
        `Account temporarily locked. Try again in ${this.LOCKOUT_DURATION / 1000} seconds`,
        'ACCOUNT_LOCKED'
      );
    }
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const hashedToken = this.hashToken(token);
      
      // Add timeout to the blacklist check
      const queryPromise = this.db.query<TokenBlacklist>(this.BLACKLIST_COLLECTION, [
        { field: 'token', operator: '==', value: hashedToken }
      ]);
      
      // Race between query and timeout
      const timeoutPromise = new Promise<TokenBlacklist[]>((_, reject) => {
        setTimeout(() => reject(new Error('Blacklist check timeout')), 1000);
      });

      const blacklistedTokens = await Promise.race([queryPromise, timeoutPromise]);

      // If we found a token, then check its expiration
      if (blacklistedTokens.length > 0) {
        const token = blacklistedTokens[0];
        return token.expiresAt > Date.now();
      }

      return false;
    } catch (error) {
      // If there's a timeout or other error checking the blacklist, 
      // fail secure by assuming the token is blacklisted
      return true;
    }
  }

  private async blacklistToken(token: string, userId: string, type: 'access' | 'refresh'): Promise<void> {
    const hashedToken = this.hashToken(token);
    const expiresAt = type === 'access' 
      ? getExpirationFromDuration(process.env.JWT_ACCESS_EXPIRES_IN || '15m')
      : getExpirationFromDuration(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
    
    try {
      // Add to blacklist with unique index on token
      await this.db.add(this.BLACKLIST_COLLECTION, {
        token: hashedToken,
        expiresAt,
        revokedAt: Date.now(),
        userId,
        type
      });
    } catch (error) {
      // If token already exists in blacklist, that's fine
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async sendEmailVerification(email: string): Promise<void> {
    const users = await this.db.query<PhoenixUser>(this.USERS_COLLECTION, [
      { field: 'email', operator: '==', value: email.toLowerCase() }
    ]);

    if (users.length === 0) {
      throw new PhoenixStoreError('User not found', 'USER_NOT_FOUND');
    }

    const user = users[0];
    
    if (user.emailVerified) {
      throw new PhoenixStoreError('Email already verified', 'EMAIL_ALREADY_VERIFIED');
    }

    // Generate verification token
    const token = await this.generateEmailToken(user.id!, 'verification');
    
    // Send verification email
    const emailOptions = generateVerificationEmail(user.email, token);
    await sendEmail(emailOptions);
  }

  async verifyEmail(token: string): Promise<void> {
    const payload = await this.verifyEmailToken(token, 'verification');
    if (!payload.sub) {
      throw new PhoenixStoreError('Invalid token', 'INVALID_TOKEN');
    }

    await this.db.update(this.USERS_COLLECTION, payload.sub, {
      emailVerified: true
    });
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const users = await this.db.query<PhoenixUser>(this.USERS_COLLECTION, [
      { field: 'email', operator: '==', value: email.toLowerCase() }
    ]);

    if (users.length === 0) {
      throw new PhoenixStoreError('User not found', 'USER_NOT_FOUND');
    }

    const user = users[0];
    
    // Generate reset token
    const token = await this.generateEmailToken(user.id!, 'reset');
    
    // Send reset email
    const emailOptions = generatePasswordResetEmail(user.email, token);
    await sendEmail(emailOptions);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Verify password requirements
    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new PhoenixStoreError(
        `Password validation failed: ${passwordValidation.errors.join(', ')}`,
        'INVALID_PASSWORD'
      );
    }

    // Verify token
    const payload = await this.verifyEmailToken(token, 'reset');
    if (!payload.sub) {
      throw new PhoenixStoreError('Invalid token', 'INVALID_TOKEN');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update password
    await this.db.update(this.USERS_COLLECTION, payload.sub, {
      passwordHash,
      failedLoginAttempts: 0,
      lastFailedLogin: null
    });
  }

  private async generateEmailToken(userId: string, type: 'verification' | 'reset'): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.db.add('email_tokens', {
      token,
      userId,
      type,
      expiresAt: expiresAt.toISOString(),
      used: false
    });

    return token;
  }

  private async verifyEmailToken(token: string, type: 'verification' | 'reset'): Promise<{ sub: string }> {
    const tokens = await this.db.query('email_tokens', [
      { field: 'token', operator: '==', value: token },
      { field: 'type', operator: '==', value: type },
      { field: 'used', operator: '==', value: false }
    ]);

    if (tokens.length === 0) {
      throw new PhoenixStoreError('Invalid or expired token', 'INVALID_TOKEN');
    }

    const emailToken = tokens[0];
    
    // Check if token is expired
    if (new Date(emailToken.expiresAt) < new Date()) {
      throw new PhoenixStoreError('Token has expired', 'TOKEN_EXPIRED');
    }

    // Mark token as used
    if (emailToken.id) {
      await this.db.update('email_tokens', emailToken.id, { used: true });
    }

    return { sub: emailToken.userId };
  }
} 