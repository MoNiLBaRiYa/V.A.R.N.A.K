import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService } from '@/lib/projects/service';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { RecommendationEngine } from '@/lib/recommendations/engine';
import { recordAuditEvent } from '@/lib/audit';
import { ApplicationScope, ProjectStatus } from '@/types/enums';
import { logger } from '@/lib/logger';

const runRecommendationSchema = z.object({
  manufacturerSlug: z.string().default('asian-paints'),
  applicationScope: z.nativeEnum(ApplicationScope),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const projectId = params.id;
    await ProjectService.getProjectById(projectId, user.internalUserId);

    const runs = await prisma.recommendationRun.findMany({
      where: { projectId },
      include: {
        recommendations: {
          include: {
            shade: true,
            factors: true,
          },
          orderBy: { rank: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ runs });
  } catch (error: any) {
    if (error.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === 'UNAUTHORIZED_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    logger.error({ error }, '[RecommendationsRoute] GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const projectId = params.id;
    const project = await ProjectService.getProjectById(projectId, user.internalUserId);

    // Reject archived project with 409 Conflict (§REQ-02, REQ-09)
    if (project.status === ProjectStatus.ARCHIVED) {
      return NextResponse.json(
        { error: 'Cannot generate recommendations for an archived project', code: 'PROJECT_ARCHIVED' },
        { status: 409 }
      );
    }

    // Rate limiting: 10 recommendation runs per day per user
    const rateLimit = await checkRateLimit(`rec_run:${user.internalUserId}`, {
      windowSeconds: 86400,
      maxRequests: 10,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: 'Daily recommendation limit reached (10 runs/day)',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.reset,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.reset) },
        }
      );
    }

    const body = await req.json();
    const parseResult = runRecommendationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid recommendation request payload', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { manufacturerSlug, applicationScope } = parseResult.data;

    // Execute 9-factor recommendation engine
    const result = await RecommendationEngine.execute({
      projectId,
      manufacturerSlug,
      applicationScope,
    });

    await recordAuditEvent({
      userId: user.internalUserId,
      eventType: 'RECOMMENDATION_RUN_COMPLETED',
      resourceType: 'RecommendationRun',
      resourceId: result.runId,
      outcome: 'SUCCESS',
      metadata: {
        projectId,
        manufacturerSlug,
        applicationScope,
        recommendationCount: result.recommendations.length,
        paletteHarmonyApplied: result.paletteHarmonyApplied,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error.code === 'CLIMATE_DATA_REQUIRED') {
      return NextResponse.json(
        {
          error: 'Climate data is required before running paint recommendations. Please confirm project location.',
          code: 'CLIMATE_DATA_REQUIRED',
        },
        { status: 422 }
      );
    }
    if (error.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === 'UNAUTHORIZED_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    logger.error({ error }, '[RecommendationsRoute] POST failed');
    return NextResponse.json(
      { error: error.message || 'Recommendation calculation failed' },
      { status: 500 }
    );
  }
}
