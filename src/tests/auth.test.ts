import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { MongoAdapter } from '../adapters/MongoAdapter';
import { AuthManager } from '../core/AuthManager';
import { CreateUserParams, SignInParams, PhoenixUser } from '../types/auth';
import { verifyToken } from '../utils/jwt';
import { getTestDbUri, setup, teardown } from './setup';

describe('AuthManager', () => {
  let db: MongoAdapter;
  let authManager: AuthManager;
  const testUser: CreateUserParams = {
    email: 'test@example.com',
    password: 'Test123!',
    displayName: 'Test User'
  };

  beforeAll(async () => {
    // Initialize MongoDB connection using test utilities
    console.log('Starting AuthManager tests...');
    try {
      await setup();
      console.log('Setting up test database connection...');
      
      db = new MongoAdapter(getTestDbUri(), 'phoenixstore_test');
      await db.connect();
      
      authManager = new AuthManager(db);
      console.log('Test database connected');
      
      // Clean up any existing test users
      const users = await db.query<PhoenixUser>('users', [
        { field: 'email', operator: '==', value: testUser.email }
      ]);
      
      for (const user of users) {
        if (user.id) {
          await db.delete('users', user.id);
        }
      }
    } catch (error) {
      console.error('Failed to setup AuthManager tests:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up test data
      const users = await db.query<PhoenixUser>('users', [
        { field: 'email', operator: '==', value: testUser.email }
      ]);
      
      for (const user of users) {
        if (user.id) {
          await db.delete('users', user.id);
        }
      }
      
      await db.disconnect();
      await teardown();
    } catch (error) {
      console.error('Failed to cleanup AuthManager tests:', error);
    }
  });

  test('should create a new user', async () => {
    const user = await authManager.createUser(testUser);
    
    expect(user).toBeDefined();
    expect(user.email).toBe(testUser.email.toLowerCase());
    if (testUser.displayName) {
      expect(user.displayName).toBe(testUser.displayName);
    }
    expect(user.disabled).toBe(false);
    expect(user.emailVerified).toBe(false);
    expect(user.passwordHash).toBeDefined();
    expect(user.id).toBeDefined();
  });

  test('should not create user with existing email', async () => {
    await expect(authManager.createUser(testUser)).rejects.toThrow('Email already exists');
  });

  test('should not create user with invalid email', async () => {
    const invalidUser = { ...testUser, email: 'invalid-email' };
    await expect(authManager.createUser(invalidUser)).rejects.toThrow('Invalid email format');
  });

  test('should sign in user with correct credentials', async () => {
    const credentials: SignInParams = {
      email: testUser.email,
      password: testUser.password
    };

    const tokens = await authManager.signIn(credentials);
    
    expect(tokens).toBeDefined();
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.expiresIn).toBeGreaterThan(0);

    // Verify token payload
    const payload = await verifyToken(tokens.accessToken);
    expect(payload.email).toBe(testUser.email.toLowerCase());
    expect(payload.type).toBe('access');
  });

  test('should not sign in with incorrect password', async () => {
    const credentials: SignInParams = {
      email: testUser.email,
      password: 'wrong-password'
    };

    await expect(authManager.signIn(credentials)).rejects.toThrow('Invalid password');
  });

  test('should not sign in non-existent user', async () => {
    const credentials: SignInParams = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    await expect(authManager.signIn(credentials)).rejects.toThrow('User not found');
  });
}); 