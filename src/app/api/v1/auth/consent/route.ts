import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit';
import { logger } from '@/lib/logger';

const consentSchema = z.object({
  privacyPolicyVersion: z.string().default('1.0'),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Privacy policy acceptance is required' }),
  }),
  aiDisclosureAccepted: z.literal(true, {
    errorMap: () => ({ message: 'AI disclosure acceptance is required' }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parseResult = consentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid consent submission',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { privacyPolicyVersion } = parseResult.data;

    // Locate internal user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ externalSubjectId: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: 'USER_NOT_FOUND', message: 'User record not found' } },
        { status: 404 }
      );
    }

    const now = new Date();

    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId: user.internalUserId },
      update: {
        privacyPolicyVersion,
        privacyAcceptedAt: now,
        aiDisclosureAcceptedAt: now,
      },
      create: {
        userId: user.internalUserId,
        privacyPolicyVersion,
        privacyAcceptedAt: now,
        aiDisclosureAcceptedAt: now,
      },
    });

    await recordAuditEvent({
      userId: user.internalUserId,
      eventType: 'CONSENT_RECORDED',
      resourceType: 'UserProfile',
      resourceId: updatedProfile.id,
      outcome: 'SUCCESS',
      metadata: {
        privacyPolicyVersion,
        privacyAcceptedAt: now.toISOString(),
        aiDisclosureAcceptedAt: now.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      consent: {
        privacyPolicyVersion: updatedProfile.privacyPolicyVersion,
        privacyAcceptedAt: updatedProfile.privacyAcceptedAt,
        aiDisclosureAcceptedAt: updatedProfile.aiDisclosureAcceptedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, '[ConsentAPI] Unexpected error in consent submission');
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to record consent' } },
      { status: 500 }
    );
  }
}
