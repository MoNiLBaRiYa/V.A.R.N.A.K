import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateApiSession } from '@/middleware/auth';
import { handlePostLoginUserSync } from '@/lib/auth/callbacks';
import { prisma } from '@/lib/db/prisma';
import * as auditModule from '@/lib/audit';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('Auth Middleware & Callbacks (src/middleware/auth.ts, src/lib/auth/callbacks.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Protection Middleware', () => {
    it('returns 401 for unauthenticated requests to /api/v1/projects', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/v1/projects'));
      const response = await validateApiSession(request);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);
      const data = await response?.json();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('allows public health check /api/v1/health without session', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/v1/health'));
      const response = await validateApiSession(request);

      expect(response).toBeNull();
    });

    it('allows requests with session token cookie', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/v1/projects'), {
        headers: {
          cookie: 'authjs.session-token=valid-session-jwt-token',
        },
      });
      const response = await validateApiSession(request);

      expect(response).toBeNull();
    });
  });

  describe('Post-Login User Sync Callbacks', () => {
    it('creates or updates user and records REGISTRATION audit event for new user', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.upsert as any).mockResolvedValue({
        internalUserId: 'user-uuid-123',
        externalSubjectId: 'entra-sub-abc',
        email: 'test@varnak.in',
        role: 'USER',
      });

      const user = await handlePostLoginUserSync(
        {
          sub: 'entra-sub-abc',
          email: 'test@varnak.in',
          name: 'Test Painter',
        },
        '192.168.1.1'
      );

      expect(user.internalUserId).toBe('user-uuid-123');
      expect(prisma.user.upsert).toHaveBeenCalled();
      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-123',
          eventType: 'REGISTRATION',
          outcome: 'SUCCESS',
        })
      );
    });

    it('records LOGIN audit event for existing user', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        internalUserId: 'user-uuid-123',
        externalSubjectId: 'entra-sub-abc',
      });
      (prisma.user.upsert as any).mockResolvedValue({
        internalUserId: 'user-uuid-123',
        externalSubjectId: 'entra-sub-abc',
        email: 'test@varnak.in',
        role: 'USER',
      });

      await handlePostLoginUserSync(
        {
          sub: 'entra-sub-abc',
          email: 'test@varnak.in',
        },
        '192.168.1.1'
      );

      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-123',
          eventType: 'LOGIN',
          outcome: 'SUCCESS',
        })
      );
    });
  });
});
