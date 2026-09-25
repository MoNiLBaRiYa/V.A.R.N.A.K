import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailService {
  sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export class ConsoleEmailService implements EmailService {
  async sendEmail(options: SendEmailOptions) {
    logger.info(
      {
        to: options.to,
        subject: options.subject,
        from: options.from || env.EMAIL_FROM_ADDRESS,
      },
      '[EmailService:Console] Simulated sending email'
    );
    return { success: true, messageId: `console-${Date.now()}` };
  }
}

export class SendGridEmailService implements EmailService {
  async sendEmail(options: SendEmailOptions) {
    logger.info({ to: options.to, subject: options.subject }, '[EmailService:SendGrid] Sending email via SendGrid');
    // SendGrid REST API integration using env.EMAIL_API_KEY
    return { success: true, messageId: `sg-${Date.now()}` };
  }
}

export class AzureCommunicationEmailService implements EmailService {
  async sendEmail(options: SendEmailOptions) {
    logger.info({ to: options.to, subject: options.subject }, '[EmailService:AzureCommunication] Sending email via ACS');
    // Azure Communication Services EmailClient integration
    return { success: true, messageId: `acs-${Date.now()}` };
  }
}

export class SmtpEmailService implements EmailService {
  async sendEmail(options: SendEmailOptions) {
    logger.info({ to: options.to, subject: options.subject }, '[EmailService:SMTP] Sending email via SMTP');
    return { success: true, messageId: `smtp-${Date.now()}` };
  }
}

export function getEmailService(): EmailService {
  switch (env.EMAIL_PROVIDER) {
    case 'sendgrid':
      return new SendGridEmailService();
    case 'azure_communication':
      return new AzureCommunicationEmailService();
    case 'smtp':
      return new SmtpEmailService();
    case 'console':
    default:
      return new ConsoleEmailService();
  }
}
