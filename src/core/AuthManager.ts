import { MongoAdapter } from '../adapters/MongoAdapter';
import { CreateUserParams, PhoenixUser, SignInParams, AuthTokens } from '../types/auth';
import { PhoenixStoreError } from '../types';
import { generateAuthTokens } from '../utils/jwt';

export class AuthManager {
  private readonly USERS_COLLECTION = 'users';

  constructor(private readonly db: MongoAdapter) {}

  async createUser(params: CreateUserParams): Promise<PhoenixUser> {
    // Validate email format
    if (!this.isValidEmail(params.email)) {
      throw new PhoenixStoreError('Invalid email format', 'INVALID_EMAIL');
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

    // Verify password
    const isValidPassword = await this.verifyPassword(params.password, user.passwordHash);
    if (!isValidPassword) {
      throw new PhoenixStoreError('Invalid password', 'INVALID_PASSWORD');
    }

    // Update last sign in time
    await this.db.update(this.USERS_COLLECTION, user.id, {
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

  private async hashPassword(password: string): Promise<string> {
    const salt = await Bun.password.hash('random_salt_string');
    return await Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: 10
    });
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await Bun.password.verify(password, hash);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
} 