import nodemailer, { Transporter } from 'nodemailer';
import { PhoenixStoreError } from '../types';
import { config } from './config';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// For testing purposes
export function setTestTransporter(testTransporter: Transporter) {
  transporter = testTransporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Sends an email using the configured SMTP transport
 * @param options Email options including recipient, subject, and content
 * @returns Promise that resolves when email is sent
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await getTransporter().sendMail({
      from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (error: any) {
    throw new PhoenixStoreError(
      `Failed to send email: ${error.message}`,
      'EMAIL_SEND_ERROR'
    );
  }
}

// Email template functions
export function generateVerificationEmail(email: string, token: string): EmailOptions {
  const verificationLink = `${config.API_URL}/auth/verify-email?token=${token}`;
  
  return {
    to: email,
    subject: 'Verify your email address',
    text: `Please verify your email address by clicking the following link: ${verificationLink}`,
    html: `
      <h1>Email Verification</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationLink}">Verify Email</a></p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `,
  };
}

export function generatePasswordResetEmail(email: string, token: string): EmailOptions {
  const resetLink = `${config.API_URL}/auth/reset-password?token=${token}`;
  
  return {
    to: email,
    subject: 'Reset your password',
    text: `Reset your password by clicking the following link: ${resetLink}`,
    html: `
      <h1>Password Reset</h1>
      <p>You requested to reset your password. Click the link below to proceed:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
    `,
  };
} 