import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { MongoAdapter } from '../adapters/MongoAdapter';
import { AuthManager } from '../core/AuthManager';
import { CreateUserParams, SignInParams, PhoenixUser, AuthTokens } from '../types/auth';
import { PhoenixStoreError } from '../types';
import { verifyToken } from '../utils/jwt';
import { getTestDbUri, setup, teardown } from './setup';

describe('AuthManager', () => {
  let db: MongoAdapter;
  let authManager: AuthManager;
  const testUser: CreateUserParams = {
    email: 'test@example.com',
    password: 'Test123!@#',
    displayName: 'Test User'
  };

  beforeAll(async () => {
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

  describe('User Creation', () => {
    describe('Valid User Creation', () => {
      test('should create a new user with valid data', async () => {
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
        expect(user.failedLoginAttempts).toBe(0);
        expect(user.lastFailedLogin).toBeNull();
        
        // Verify metadata
        expect(user.metadata).toBeDefined();
        expect(new Date(user.metadata.creationTime)).toBeInstanceOf(Date);
        expect(new Date(user.metadata.lastSignInTime)).toBeInstanceOf(Date);
        expect(user.metadata.creationTime).toBe(user.metadata.lastSignInTime);
      });

      test('should create user with minimum required fields', async () => {
        const minimalUser: CreateUserParams = {
          email: 'minimal@example.com',
          password: 'Test123!@#'
        };

        const user = await authManager.createUser(minimalUser);
        expect(user.email).toBe(minimalUser.email.toLowerCase());
        expect(user.displayName).toBeNull();
        expect(user.photoURL).toBeNull();
      });
    });

    describe('Email Validation', () => {
      const validEmails = [
        'simple@example.com',
        'very.common@example.com',
        'disposable.style.email.with+symbol@example.com',
        'other.email-with-hyphen@example.com',
        'fully-qualified-domain@example.com',
        'user.name+tag+sorting@example.com',
        'x@example.com',
        'example-indeed@strange-example.com',
        'example@s.example'
      ];

      validEmails.forEach(email => {
        test(`should accept valid email: ${email}`, async () => {
          const user = { ...testUser, email };
          await expect(authManager.createUser(user)).resolves.toBeDefined();
          // Clean up
          const users = await db.query<PhoenixUser>('users', [
            { field: 'email', operator: '==', value: email.toLowerCase() }
          ]);
          for (const u of users) {
            if (u.id) await db.delete('users', u.id);
          }
        });
      });

      const invalidEmails = [
        { email: '', error: 'Email is required' },
        { email: 'invalid-email', error: 'Invalid email format' },
        { email: '@example.com', error: 'Invalid email format' },
        { email: 'test@', error: 'Invalid email domain' },
        { email: 'test@example', error: 'Invalid email domain' },
        { email: 'a'.repeat(256) + '@example.com', error: 'Email is too long' }
      ];

      invalidEmails.forEach(({ email, error }) => {
        test(`should reject invalid email: ${email}`, async () => {
          const invalidUser = { ...testUser, email };
          await expect(authManager.createUser(invalidUser)).rejects.toThrow(error);
        });
      });
    });

    describe('Password Validation', () => {
      const validPasswords = [
        'StrongP@ss123',
        'C0mplex!Pass',
        'Secure123!@#Pwd',
        'P@ssw0rd!Complex',
        'Test!Pass123Word'
      ];

      validPasswords.forEach(password => {
        test(`should accept valid password: ${password}`, async () => {
          const user = { ...testUser, email: `test-${Date.now()}@example.com`, password };
          await expect(authManager.createUser(user)).resolves.toBeDefined();
        });
      });

      const invalidPasswords = [
        { password: '', error: 'Password is required' },
        { password: '12345', error: 'must be at least 8 characters' },
        { password: 'password', error: 'must contain at least one uppercase letter' },
        { password: '12345678', error: 'must contain at least one uppercase letter' },
        { password: 'Password', error: 'must contain at least one number' },
        { password: 'Password1', error: 'must contain at least one special character' },
        { password: 'a'.repeat(129), error: 'must not exceed 128 characters' },
        { password: 'Password111', error: 'must contain at least one special character' },
        { password: 'Passwordddd1!', error: 'should not contain repeated characters' }
      ];

      invalidPasswords.forEach(({ password, error }) => {
        test(`should reject invalid password: ${password}`, async () => {
          const invalidUser = { ...testUser, password };
          await expect(authManager.createUser(invalidUser)).rejects.toThrow(error);
        });
      });
    });

    test('should not create user with existing email', async () => {
      await expect(authManager.createUser(testUser)).rejects.toThrow('Email already exists');
    });
  });

  describe('Authentication', () => {
    let testUserCredentials: SignInParams;
    let userId: string;

    beforeEach(async () => {
      // Create a fresh test user for each auth test
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const user = await authManager.createUser({
        email: uniqueEmail,
        password: 'StrongP@ss123',
        displayName: 'Test User'
      });
      if (!user.id) {
        throw new Error('Failed to create test user - no ID returned');
      }
      userId = user.id;
      testUserCredentials = {
        email: uniqueEmail,
        password: 'StrongP@ss123'
      };
    });

    test('should sign in user with correct credentials', async () => {
      const beforeSignIn = Date.now();
      const tokens = await authManager.signIn(testUserCredentials);
      
      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBeGreaterThan(0);

      const payload = await verifyToken(tokens.accessToken);
      expect(payload.email).toBe(testUserCredentials.email.toLowerCase());
      expect(payload.type).toBe('access');
      expect(payload.sub).toBeDefined();

      const users = await db.query<PhoenixUser>('users', [
        { field: 'email', operator: '==', value: testUserCredentials.email }
      ]);
      const user = users[0];
      expect(user).toBeDefined();
      expect(new Date(user.metadata.lastSignInTime).getTime()).toBeGreaterThan(beforeSignIn);
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lastFailedLogin).toBeNull();
    });

    describe('Failed Login Attempts', () => {
      test('should increment failed attempts and eventually lock account', async () => {
        const wrongCredentials = { ...testUserCredentials, password: 'wrong-password' };
        
        // Track failed attempts
        for (let i = 0; i < 5; i++) {
          try {
            await authManager.signIn(wrongCredentials);
            throw new Error('Should not succeed with wrong password');
          } catch (error: any) {
            expect(error).toBeInstanceOf(PhoenixStoreError);
            
            // Last attempt should trigger lockout
            if (i === 4) {
              expect(error.message).toContain('Account temporarily locked');
            } else {
              expect(error.message).toBe('Invalid password');
            }

            // Verify attempt count
            const users = await db.query<PhoenixUser>('users', [
              { field: 'email', operator: '==', value: testUserCredentials.email }
            ]);
            const user = users[0];
            expect(user.failedLoginAttempts).toBe(i + 1);
            expect(user.lastFailedLogin).toBeDefined();
          }
        }
      });

      test('should maintain lockout for duration', async () => {
        // First lock the account
        const wrongCredentials = { ...testUserCredentials, password: 'wrong-password' };
        
        // Attempt until locked
        for (let i = 0; i < 5; i++) {
          try {
            await authManager.signIn(wrongCredentials);
          } catch (error) {
            // Expected errors
          }
        }

        // Verify account is locked even with correct credentials
        try {
          await authManager.signIn(testUserCredentials);
          throw new Error('Should not succeed while locked');
        } catch (error: any) {
          expect(error).toBeInstanceOf(PhoenixStoreError);
          expect(error.message).toContain('Account temporarily locked');
          expect(error.code).toBe('ACCOUNT_LOCKED');
        }
      });

      test('should reset failed attempts after successful login', async () => {
        // Create a fresh user for this test
        const email = `reset-${Date.now()}@example.com`;
        const password = 'StrongP@ss123';
        const user = await authManager.createUser({
          email,
          password,
          displayName: 'Reset Test User'
        });

        // Fail twice
        const wrongCredentials = { email, password: 'wrong-password' };
        for (let i = 0; i < 2; i++) {
          try {
            await authManager.signIn(wrongCredentials);
          } catch (error) {
            // Expected errors
          }
        }

        // Verify failed attempts were recorded
        let users = await db.query<PhoenixUser>('users', [
          { field: 'email', operator: '==', value: email }
        ]);
        expect(users[0].failedLoginAttempts).toBe(2);

        // Successfully sign in
        await authManager.signIn({ email, password });

        // Verify attempts were reset
        users = await db.query<PhoenixUser>('users', [
          { field: 'email', operator: '==', value: email }
        ]);
        expect(users[0].failedLoginAttempts).toBe(0);
        expect(users[0].lastFailedLogin).toBeNull();
      });
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

    test('should not sign in disabled user', async () => {
      // Create a new user specifically for this test
      const disabledUserEmail = `disabled-${Date.now()}@example.com`;
      let user = await authManager.createUser({
        email: disabledUserEmail,
        password: 'StrongP@ss123',
        displayName: 'Disabled User'
      });

      if (!user.id) {
        throw new Error('Failed to create test user - no ID returned');
      }

      // Verify user was created successfully
      let users = await db.query<PhoenixUser>('users', [
        { field: 'email', operator: '==', value: disabledUserEmail }
      ]);
      expect(users.length).toBe(1);
      expect(users[0].disabled).toBe(false);

      // Disable the user with minimal update
      await db.update('users', user.id, { disabled: true });
      
      // Add a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify user was disabled
      users = await db.query<PhoenixUser>('users', [
        { field: 'email', operator: '==', value: disabledUserEmail }
      ]);
      expect(users.length).toBe(1);
      expect(users[0].disabled).toBe(true);

      // Attempt to sign in with disabled account
      try {
        await authManager.signIn({
          email: disabledUserEmail,
          password: 'StrongP@ss123'
        });
        throw new Error('Should not succeed signing in with disabled account');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PhoenixStoreError);
        expect(error.message).toBe('User account is disabled');
        expect(error.code).toBe('USER_DISABLED');
      }
    });
  });

  describe('Token Management', () => {
    let testTokenUser: PhoenixUser;
    let userTokens: AuthTokens;

    beforeEach(async () => {
      // Create a fresh user for token tests
      const email = `token-${Date.now()}@example.com`;
      testTokenUser = await authManager.createUser({
        email,
        password: 'StrongP@ss123',
        displayName: 'Token Test User'
      });

      // Sign in to get initial tokens
      userTokens = await authManager.signIn({
        email,
        password: 'StrongP@ss123'
      });
    });

    test('should generate different tokens for access and refresh', async () => {
      const accessPayload = await verifyToken(userTokens.accessToken);
      const refreshPayload = await verifyToken(userTokens.refreshToken);

      expect(accessPayload.type).toBe('access');
      expect(refreshPayload.type).toBe('refresh');
      expect(userTokens.accessToken).not.toBe(userTokens.refreshToken);
    });

    test('should include all required claims in tokens', async () => {
      const payload = await verifyToken(userTokens.accessToken);

      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('email');
      expect(payload).toHaveProperty('type');
      expect(payload.email).toBe(testTokenUser.email.toLowerCase());
    });

    describe('Token Refresh', () => {
      test('should refresh tokens with valid refresh token', async () => {
        const newTokens = await authManager.refreshToken({
          refreshToken: userTokens.refreshToken
        });

        expect(newTokens.accessToken).toBeDefined();
        expect(newTokens.refreshToken).toBeDefined();
        expect(newTokens.accessToken).not.toBe(userTokens.accessToken);
        expect(newTokens.refreshToken).not.toBe(userTokens.refreshToken);

        // Verify new tokens
        const accessPayload = await verifyToken(newTokens.accessToken);
        const refreshPayload = await verifyToken(newTokens.refreshToken);
        if (!testTokenUser.id) {
          throw new Error('Test user ID not found');
        }
        expect(accessPayload.sub).toBe(testTokenUser.id);
        expect(refreshPayload.sub).toBe(testTokenUser.id);
      });

      test('should not refresh tokens with access token', async () => {
        await expect(
          authManager.refreshToken({
            refreshToken: userTokens.accessToken
          })
        ).rejects.toThrow('Invalid refresh token');
      });

      test('should not refresh tokens for disabled user', async () => {
        if (!testTokenUser.id) {
          throw new Error('Test user ID not found');
        }
        // Disable the user
        await db.update('users', testTokenUser.id, { disabled: true });
        
        // Add a small delay to ensure database consistency
        await new Promise(resolve => setTimeout(resolve, 100));

        await expect(
          authManager.refreshToken({
            refreshToken: userTokens.refreshToken
          })
        ).rejects.toThrow('User account is disabled');
      });
    });

    describe('Token Revocation', () => {
      test('should revoke access token', async () => {
        await authManager.revokeToken(userTokens.accessToken, 'access');

        // Try to use the token
        await expect(
          authManager.verifyToken(userTokens.accessToken, 'access')
        ).rejects.toThrow('Token has been revoked');
      });

      test('should revoke refresh token', async () => {
        await authManager.revokeToken(userTokens.refreshToken, 'refresh');

        // Try to refresh with revoked token
        await expect(
          authManager.refreshToken({
            refreshToken: userTokens.refreshToken
          })
        ).rejects.toThrow('Token has been revoked');
      });

      test('should revoke expired tokens', async () => {
        // Wait for token to expire (we'll use a very short-lived token for this test)
        const originalExpiry = process.env.JWT_ACCESS_EXPIRES_IN;
        process.env.JWT_ACCESS_EXPIRES_IN = '1s';
        const shortLivedTokens = await authManager.signIn({
          email: testTokenUser.email,
          password: 'StrongP@ss123'
        });

        // Wait for token to expire
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Should still be able to revoke expired token
        await authManager.revokeToken(shortLivedTokens.accessToken, 'access');

        // Verify token is blacklisted
        await expect(
          authManager.verifyToken(shortLivedTokens.accessToken, 'access')
        ).rejects.toThrow(/Token has (expired|been revoked)/);

        // Restore original expiry
        process.env.JWT_ACCESS_EXPIRES_IN = originalExpiry;
      });

      test('should not allow reuse of refresh token after refresh', async () => {
        // First refresh is successful
        const newTokens = await authManager.refreshToken({
          refreshToken: userTokens.refreshToken
        });

        // Second refresh with old token should fail
        await expect(
          authManager.refreshToken({
            refreshToken: userTokens.refreshToken
          })
        ).rejects.toThrow('Token has been revoked');

        // New refresh token should work
        await expect(
          authManager.refreshToken({
            refreshToken: newTokens.refreshToken
          })
        ).resolves.toBeDefined();
      });
    });
  });
}); 