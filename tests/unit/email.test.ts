import { describe, it, expect } from 'vitest';
import { getEmailService, ConsoleEmailService } from '@/lib/email/service';

describe('Email Service Abstraction (src/lib/email/service.ts)', () => {
  it('returns ConsoleEmailService when EMAIL_PROVIDER is console', async () => {
    const service = getEmailService();
    expect(service).toBeInstanceOf(ConsoleEmailService);

    const result = await service.sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('console-');
  });
});
