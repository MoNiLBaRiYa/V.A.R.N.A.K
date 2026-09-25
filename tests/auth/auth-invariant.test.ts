import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { authConfig } from '@/lib/auth/config';

describe('Security & Architectural Invariants (DEC-02 / Task 0.5)', () => {
  it('Task 0.5.5: Prisma schema contains zero local password, hash, salt, or totp fields in Users table', () => {
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Extract User and UserProfile model blocks
    const userModelMatch = schemaContent.match(/model\s+User\s+\{[\s\S]*?\}/);
    const profileModelMatch = schemaContent.match(/model\s+UserProfile\s+\{[\s\S]*?\}/);

    expect(userModelMatch).not.toBeNull();
    expect(profileModelMatch).not.toBeNull();

    const userModelText = userModelMatch![0];
    const profileModelText = profileModelMatch![0];

    // Forbidden credential fields
    const forbiddenFields = [
      /\bpassword\b/i,
      /\bpasswordhash\b/i,
      /\bhash\b/i,
      /\bsalt\b/i,
      /\btotp\b/i,
      /\bsecret\b/i,
    ];

    for (const pattern of forbiddenFields) {
      expect(userModelText).not.toMatch(pattern);
      expect(profileModelText).not.toMatch(pattern);
    }
  });

  it('Task 0.5.6: No custom credential or local password authentication routes exist', () => {
    const apiAuthDir = path.resolve(__dirname, '../../src/app/api/auth');
    
    // Check if custom register/login subdirectories exist in src/app/api/auth
    const forbiddenRoutes = ['register', 'login', 'signup', 'reset-password'];
    
    for (const route of forbiddenRoutes) {
      const routePath = path.join(apiAuthDir, route);
      expect(fs.existsSync(routePath)).toBe(false);
    }
  });

  it('Task 0.5.1: Microsoft Entra External ID is configured as the sole identity provider in Auth.js', () => {
    expect(authConfig.providers).toHaveLength(1);
    const provider = authConfig.providers[0] as { id: string; name: string; type: string };
    expect(provider.id).toBe('microsoft-entra-id');
    expect(provider.type).toBe('oidc');
    expect(provider.name).toBe('Microsoft Entra External ID');
  });
});
