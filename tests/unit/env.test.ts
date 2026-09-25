import { describe, it, expect } from 'vitest';
import { parseEnv } from '@/lib/env';

describe('Environment Variable Validation (src/lib/env.ts)', () => {
  const validMockEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    DATABASE_URL: 'sqlserver://localhost:1433;database=varnak;user=sa;password=Secret123;',
    AZURE_STORAGE_ACCOUNT_NAME: 'devstoreaccount1',
    AZURE_STORAGE_ACCOUNT_KEY: 'test-key',
    AZURE_STORAGE_CONTAINER_NAME: 'project-images',
    REDIS_URL: 'redis://localhost:6379',
    ENTRA_TENANT_ID: 'tenant-123',
    ENTRA_CLIENT_ID: 'client-123',
    ENTRA_CLIENT_SECRET: 'secret-123',
    NEXTAUTH_SECRET: 'super-secret-key-at-least-16-characters-long',
    NEXTAUTH_URL: 'http://localhost:3000',
  };

  it('successfully parses valid environment variables', () => {
    const parsed = parseEnv(validMockEnv);
    expect(parsed.DATABASE_URL).toBe(validMockEnv.DATABASE_URL);
    expect(parsed.PORT).toBe(3000);
    expect(parsed.IMAGE_ANALYSIS_MODEL).toBe('gemini-1.5-pro');
  });

  it('throws descriptive error when required variables are missing', () => {
    const invalidEnv = { ...validMockEnv };
    delete (invalidEnv as Record<string, unknown>).DATABASE_URL;

    expect(() => parseEnv(invalidEnv)).toThrowError(/DATABASE_URL.*(Required|required)/);
  });

  it('enforces NEXTAUTH_SECRET minimum length', () => {
    const invalidEnv = { ...validMockEnv, NEXTAUTH_SECRET: 'short' };
    expect(() => parseEnv(invalidEnv)).toThrowError(/NEXTAUTH_SECRET must be at least 16 characters/);
  });
});
