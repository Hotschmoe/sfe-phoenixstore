import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { MongoAdapter } from '../adapters/MongoAdapter';
import { AuthManager } from '../core/AuthManager';
import { CreateUserParams, SignInParams, PhoenixUser } from '../types/auth';
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
        'Test123!@#',
        'Complex1!Password',
        'Very2Complex!Password',
        'SuperSecure123!@#',
        '!@#$%^&*()123ABCabc'
      ];

      validPasswords.forEach(password => {
        test(`should accept valid password: ${password}`, async () => {
          const user = { ...testUser, email: `test-${password}@example.com`, password };
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
    test('should sign in user with correct credentials', async () => {
      const credentials: SignInParams = {
        email: testUser.email,
        password: testUser.password
      };

      const beforeSignIn = Date.now();
      const tokens = await authManager.signIn(credentials);
      
      // Token validation
      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBeGreaterThan(0);

      // Verify access token payload
      const payload = await verifyToken(tokens.accessToken);
      expect(payload.email).toBe(testUser.email.toLowerCase());
      expect(payload.type).toBe('access');
      expect(payload.sub).toBeDefined();

      // Verify last sign in time was updated
      const users = await db.query<PhoenixUser>('users', [
        { field: 'email', operator: '==', value: testUser.email }
      ]);
      const user = users[0];
      expect(user).toBeDefined();
      if (user && user.metadata.lastSignInTime) {
        expect(new Date(user.metadata.lastSignInTime).getTime()).toBeGreaterThan(beforeSignIn);
      }
      // Verify failed attempts were reset
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lastFailedLogin).toBeNull();
    });

    describe('Failed Login Attempts', () => {
      test('should increment failed attempts and eventually lock account', async () => {
        const credentials: SignInParams = {
          email: testUser.email,
          password: 'wrong-password'
        };

        // Attempt multiple failed logins
        for (let i = 0; i < 4; i++) {
          try {
            await authManager.signIn(credentials);
          } catch (error: any) {
            if (error instanceof PhoenixStoreError) {
              expect(error.message).toBe('Invalid password');
            } else {
              throw error;
            }
          }

          // Verify attempt count after each failure
          const users = await db.query<PhoenixUser>('users', [
            { field: 'email', operator: '==', value: testUser.email }
          ]);
          const user = users[0];
          expect(user.failedLoginAttempts).toBe(i + 1);
          expect(user.lastFailedLogin).toBeDefined();
        }

        // Fifth attempt should lock the account
        try {
          await authManager.signIn(credentials);
        } catch (error: any) {
          if (error instanceof PhoenixStoreError) {
            expect(error.message).toBe('Invalid password');
          } else {
            throw error;
          }
        }

        // Verify account is locked
        try {
          await authManager.signIn({
            email: testUser.email,
            password: testUser.password // Even with correct password
          });
          throw new Error('Should not reach here');
        } catch (error: any) {
          if (error instanceof PhoenixStoreError) {
            expect(error.message).toContain('Account temporarily locked');
          } else {
            throw error;
          }
        }
      }, 10000); // Increase timeout for this test

      test('should reset failed attempts after successful login', async () => {
        // Wait for lockout to expire (using a mock duration for tests)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Try correct login
        const credentials: SignInParams = {
          email: testUser.email,
          password: testUser.password
        };

        await authManager.signIn(credentials);

        const users = await db.query<PhoenixUser>('users', [
          { field: 'email', operator: '==', value: testUser.email }
        ]);
        const user = users[0];
        expect(user.failedLoginAttempts).toBe(0);
        expect(user.lastFailedLogin).toBeNull();
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
      // Disable the test user
      const users = await db.query<PhoenixUser>('users', [
        { field: 'email', operator: '==', value: testUser.email }
      ]);
      
      const user = users[0];
      if (!user || !user.id) {
        throw new Error('Test user not found');
      }

      await db.update('users', user.id, { disabled: true });

      const credentials: SignInParams = {
        email: testUser.email,
        password: testUser.password
      };

      await expect(authManager.signIn(credentials)).rejects.toThrow('User account is disabled');

      // Re-enable the user for other tests
      await db.update('users', user.id, { disabled: false });
    });
  });

  describe('Token Management', () => {
    test('should generate different tokens for access and refresh', async () => {
      const credentials: SignInParams = {
        email: testUser.email,
        password: testUser.password
      };

      const tokens = await authManager.signIn(credentials);
      
      const accessPayload = await verifyToken(tokens.accessToken);
      const refreshPayload = await verifyToken(tokens.refreshToken);

      expect(accessPayload.type).toBe('access');
      expect(refreshPayload.type).toBe('refresh');
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });

    test('should include all required claims in tokens', async () => {
      const credentials: SignInParams = {
        email: testUser.email,
        password: testUser.password
      };

      const tokens = await authManager.signIn(credentials);
      const payload = await verifyToken(tokens.accessToken);

      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('email');
      expect(payload).toHaveProperty('type');
      expect(payload.email).toBe(testUser.email.toLowerCase());
    });
  });
}); 