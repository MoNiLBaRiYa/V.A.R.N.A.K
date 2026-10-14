import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService } from '@/lib/projects/service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: { id: string; runId: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id: projectId, runId } = params;
    await ProjectService.getProjectById(user.internalUserId, projectId);

    const run = await prisma.recommendationRun.findFirst({
      where: { id: runId, projectId },
      include: {
        recommendations: {
          include: {
            shade: {
              include: {
                product: {
                  include: { brand: true },
                },
              },
            },
            factors: true,
          },
          orderBy: { rank: 'asc' },
        },
        scoringWeightVersion: true,
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Recommendation run not found', code: 'RUN_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ run });
  } catch (error: any) {
    if (error.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === 'UNAUTHORIZED_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    logger.error({ error }, '[RecommendationRunRoute] GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
