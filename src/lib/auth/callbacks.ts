import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit';
import { logger } from '@/lib/logger';

export interface UserSyncProfile {
  sub: string;
  email: string;
  name?: string | null;
}

export async function handlePostLoginUserSync(profile: UserSyncProfile, ipAddress?: string) {
  if (!profile.sub || !profile.email) {
    throw new Error('Invalid user profile: sub and email are required');
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { externalSubjectId: profile.sub },
    });

    const isNewUser = !existingUser;

    const user = await prisma.user.upsert({
      where: { externalSubjectId: profile.sub },
      update: {
        email: profile.email,
        lastLoginAt: new Date(),
      },
      create: {
        externalSubjectId: profile.sub,
        email: profile.email,
        lastLoginAt: new Date(),
        profile: profile.name
          ? {
              create: {
                name: profile.name,
              },
            }
          : undefined,
      },
      include: {
        profile: true,
      },
    });

    // Record audit event
    await recordAuditEvent({
      userId: user.internalUserId,
      eventType: isNewUser ? 'REGISTRATION' : 'LOGIN',
      resourceType: 'User',
      resourceId: user.internalUserId,
      outcome: 'SUCCESS',
      sourceIp: ipAddress,
      metadata: {
        authProvider: 'EntraExternalID',
        email: user.email,
        isNewUser,
      },
    });

    return user;
  } catch (error) {
    logger.error({ error, profile }, '[AuthCallbacks] Failed to sync user after login');

    await recordAuditEvent({
      userId: null,
      eventType: 'LOGIN_FAILURE',
      resourceType: 'User',
      resourceId: profile.sub,
      outcome: 'FAILURE',
      sourceIp: ipAddress,
      metadata: {
        authProvider: 'EntraExternalID',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}
