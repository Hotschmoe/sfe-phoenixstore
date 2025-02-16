import { describe, expect, test, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { MongoAdapter } from '../adapters/MongoAdapter';
import { AuthManager } from '../core/AuthManager';
import { CreateUserParams, PhoenixUser } from '../types/auth';
import { getTestDbUri, setup, teardown } from './setup';
import nodemailer from 'nodemailer';
import { config } from '../utils/config';
import { setTestTransporter } from '../utils/email';

// Create a mock transporter
const mockTransporter = {
  sendMail: mock(() => Promise.resolve({ messageId: 'test-message-id' }))
};

describe('Email Functionality', () => {
  let db: MongoAdapter;
  let authManager: AuthManager;
  let testUser: PhoenixUser;
  const testUserParams: CreateUserParams = {
    email: 'test-email@example.com',
    password: 'Test123!@#',
    displayName: 'Test User'
  };

  beforeAll(async () => {
    try {
      await setup();
      // Set up test transporter
      setTestTransporter(mockTransporter as any);
      
      db = new MongoAdapter(getTestDbUri(), `${config.MONGODB_DATABASE}_test`);
      await db.connect();
      authManager = new AuthManager(db);
    } catch (error) {
      console.error('Failed to setup email tests:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Reset mock between tests
    mockTransporter.sendMail.mockReset();
    
    // Clean up any existing test users and tokens
    const users = await db.query<PhoenixUser>('users', [
      { field: 'email', operator: '==', value: testUserParams.email }
    ]);
    
    for (const user of users) {
      if (user.id) {
        await db.delete('users', user.id);
      }
    }

    // Clean up email tokens
    const tokens = await db.query('email_tokens', []);
    for (const token of tokens) {
      if (token.id) {
        await db.delete('email_tokens', token.id);
      }
    }

    // Create a fresh test user
    testUser = await authManager.createUser(testUserParams);
  });

  afterAll(async () => {
    try {
      // Clean up test data
      const users = await db.query<PhoenixUser>('users', [
        { field: 'email', operator: '==', value: testUserParams.email }
      ]);
      
      for (const user of users) {
        if (user.id) {
          await db.delete('users', user.id);
        }
      }

      // Clean up email tokens
      const tokens = await db.query('email_tokens', []);
      for (const token of tokens) {
        if (token.id) {
          await db.delete('email_tokens', token.id);
        }
      }
      
      await db.disconnect();
      await teardown();
    } catch (error) {
      console.error('Failed to cleanup email tests:', error);
    }
  });

  describe('Email Verification', () => {
    test('should send verification email to unverified user', async () => {
      // Send verification email
      await authManager.sendEmailVerification(testUser.email);
      
      // Verify email token was created
      const tokens = await db.query('email_tokens', [
        { field: 'userId', operator: '==', value: testUser.id },
        { field: 'type', operator: '==', value: 'verification' }
      ]);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0].used).toBe(false);
      expect(new Date(tokens[0].expiresAt)).toBeInstanceOf(Date);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });

    test('should not send verification email to already verified user', async () => {
      // First verify the user
      await db.update('users', testUser.id!, { emailVerified: true });

      // Verify the update was successful
      const updatedUser = await db.get<PhoenixUser>('users', testUser.id!);
      if (!updatedUser) {
        throw new Error('Failed to get updated user');
      }
      expect(updatedUser.emailVerified).toBe(true);

      // Try to send verification email
      try {
        await authManager.sendEmailVerification(testUser.email);
        throw new Error('Should not reach this point');
      } catch (error: any) {
        expect(error.message).toBe('Email already verified');
      }

      // Verify no email was sent
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    test('should verify email with valid token', async () => {
      // Send verification email to create token
      await authManager.sendEmailVerification(testUser.email);

      // Get the token
      const tokens = await db.query('email_tokens', [
        { field: 'userId', operator: '==', value: testUser.id },
        { field: 'type', operator: '==', value: 'verification' }
      ]);

      expect(tokens.length).toBe(1);

      // Verify email
      await authManager.verifyEmail(tokens[0].token);

      // Check user is verified
      const users = await db.query<PhoenixUser>('users', [
        { field: 'email', operator: '==', value: testUser.email }
      ]);
      expect(users[0].emailVerified).toBe(true);

      // Check token is marked as used
      const usedToken = await db.query('email_tokens', [
        { field: 'token', operator: '==', value: tokens[0].token }
      ]);
      expect(usedToken[0].used).toBe(true);
    });

    test('should not verify email with invalid token', async () => {
      const promise = authManager.verifyEmail('invalid-token');
      await expect(promise).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('Password Reset', () => {
    test('should send password reset email', async () => {
      await authManager.sendPasswordResetEmail(testUser.email);
      
      // Verify reset token was created
      const tokens = await db.query('email_tokens', [
        { field: 'userId', operator: '==', value: testUser.id },
        { field: 'type', operator: '==', value: 'reset' }
      ]);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0].used).toBe(false);
      expect(new Date(tokens[0].expiresAt)).toBeInstanceOf(Date);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    test('should reset password with valid token', async () => {
      // Send reset email to create token
      await authManager.sendPasswordResetEmail(testUser.email);

      // Get the token
      const tokens = await db.query('email_tokens', [
        { field: 'userId', operator: '==', value: testUser.id },
        { field: 'type', operator: '==', value: 'reset' }
      ]);

      expect(tokens.length).toBe(1);

      const newPassword = 'NewTest123!@#';
      await authManager.resetPassword(tokens[0].token, newPassword);

      // Try to sign in with new password
      const signInResult = await authManager.signIn({
        email: testUser.email,
        password: newPassword
      });
      expect(signInResult.accessToken).toBeDefined();
      expect(signInResult.refreshToken).toBeDefined();

      // Check token is marked as used
      const usedToken = await db.query('email_tokens', [
        { field: 'token', operator: '==', value: tokens[0].token }
      ]);
      expect(usedToken[0].used).toBe(true);
    });

    test('should not reset password with invalid token', async () => {
      const promise = authManager.resetPassword('invalid-token', 'NewTest123!@#');
      await expect(promise).rejects.toThrow('Invalid or expired token');
    });

    test('should not reset password with invalid password format', async () => {
      // Send reset email to create token
      await authManager.sendPasswordResetEmail(testUser.email);

      // Get the token
      const tokens = await db.query('email_tokens', [
        { field: 'userId', operator: '==', value: testUser.id },
        { field: 'type', operator: '==', value: 'reset' }
      ]);

      // Try to reset with invalid password
      const promise = authManager.resetPassword(tokens[0].token, 'weak');
      await expect(promise).rejects.toThrow('Password validation failed');
    });
  });

  describe('Error Cases', () => {
    test('should not send emails to non-existent users', async () => {
      const nonExistentEmail = 'nonexistent@example.com';
      
      await expect(authManager.sendEmailVerification(nonExistentEmail))
        .rejects.toThrow('User not found');
      
      await expect(authManager.sendPasswordResetEmail(nonExistentEmail))
        .rejects.toThrow('User not found');
    });

    test('should not allow reuse of expired tokens', async () => {
      // Send verification email to create token
      await authManager.sendEmailVerification(testUser.email);

      // Get the token
      const tokens = await db.query('email_tokens', [
        { field: 'userId', operator: '==', value: testUser.id },
        { field: 'type', operator: '==', value: 'verification' }
      ]);

      expect(tokens.length).toBe(1);
      const token = tokens[0];

      // Manually expire the token
      if (token.id) {
        const pastDate = new Date(Date.now() - 60000); // 1 minute ago
        await db.update('email_tokens', token.id, {
          expiresAt: pastDate.toISOString()
        });
      }

      // Try to use expired token
      try {
        await authManager.verifyEmail(token.token);
        throw new Error('Should not reach this point');
      } catch (error: any) {
        expect(error.message).toBe('Token has expired');
      }
    });
  });
}); 