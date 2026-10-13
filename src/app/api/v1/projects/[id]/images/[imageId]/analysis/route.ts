import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService } from '@/lib/projects/service';
import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit';
import { AnalysisState, ApplicationScope } from '@/types/enums';
import { logger } from '@/lib/logger';

const updateAnalysisSchema = z.object({
  spaceType: z.string().optional(),
  isInterior: z.boolean().optional(),
  facadeType: z.string().nullable().optional(),
  floorCount: z.number().int().min(1).max(200).nullable().optional(),
  architecturalStyle: z.string().optional(),
  visibleSurfaces: z.array(z.string()).optional(),
  naturalLightQuality: z.string().optional(),
  paintableRegions: z.array(z.string()).optional(),
  applicationScope: z.nativeEnum(ApplicationScope).optional(),
});

interface RouteParams {
  params: { id: string; imageId: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id: projectId, imageId } = params;
    await ProjectService.getProjectById(projectId, user.internalUserId);

    const image = await prisma.projectImage.findFirst({
      where: { id: imageId, projectId },
      include: { analysisResult: true },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found', code: 'IMAGE_NOT_FOUND' }, { status: 404 });
    }

    if (!image.analysisResult) {
      return NextResponse.json(
        { error: 'Analysis result pending or not available', code: 'ANALYSIS_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ analysisResult: image.analysisResult });
  } catch (error: any) {
    if (error.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === 'UNAUTHORIZED_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    logger.error({ error }, '[AnalysisRoute] GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id: projectId, imageId } = params;
    await ProjectService.getProjectById(projectId, user.internalUserId);

    const image = await prisma.projectImage.findFirst({
      where: { id: imageId, projectId },
      include: { analysisResult: true },
    });

    if (!image || !image.analysisResult) {
      return NextResponse.json(
        { error: 'Image or analysis result not found', code: 'ANALYSIS_NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parseResult = updateAnalysisSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid analysis update payload', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const current = image.analysisResult;
    const warnings: string[] = [];

    // Detect if user modified any field
    let hasModifications = false;

    if (data.spaceType !== undefined && data.spaceType !== current.spaceType) {
      hasModifications = true;
    }
    if (data.isInterior !== undefined && data.isInterior !== current.isInterior) {
      hasModifications = true;
    }
    if (data.facadeType !== undefined && data.facadeType !== current.facadeType) {
      hasModifications = true;
    }
    if (data.floorCount !== undefined && data.floorCount !== current.floorCount) {
      hasModifications = true;
    }
    if (data.architecturalStyle !== undefined && data.architecturalStyle !== current.architecturalStyle) {
      hasModifications = true;
    }
    if (data.naturalLightQuality !== undefined && data.naturalLightQuality !== current.naturalLightQuality) {
      hasModifications = true;
    }
    if (data.visibleSurfaces !== undefined) {
      const currentSurfaces = current.visibleSurfaces ? JSON.parse(current.visibleSurfaces) : [];
      if (JSON.stringify(data.visibleSurfaces.slice().sort()) !== JSON.stringify(currentSurfaces.slice().sort())) {
        hasModifications = true;
      }
    }
    if (data.paintableRegions !== undefined) {
      const currentRegions = current.paintableRegions ? JSON.parse(current.paintableRegions) : [];
      if (JSON.stringify(data.paintableRegions.slice().sort()) !== JSON.stringify(currentRegions.slice().sort())) {
        hasModifications = true;
      }
    }

    const nextState = hasModifications ? AnalysisState.USER_OVERRIDDEN : AnalysisState.USER_CONFIRMED;
    const effectiveIsInterior = data.isInterior !== undefined ? data.isInterior : current.isInterior;

    // Consistency Check (REQ-7.7)
    if (data.applicationScope) {
      if (effectiveIsInterior === true && data.applicationScope === ApplicationScope.EXTERIOR) {
        warnings.push('Image is classified as Interior, but project scope is Exterior.');
      } else if (effectiveIsInterior === false && data.applicationScope === ApplicationScope.INTERIOR) {
        warnings.push('Image is classified as Exterior, but project scope is Interior.');
      }
    }

    const updated = await prisma.imageAnalysisResult.update({
      where: { projectImageId: imageId },
      data: {
        spaceType: data.spaceType !== undefined ? data.spaceType : current.spaceType,
        isInterior: effectiveIsInterior,
        facadeType: data.facadeType !== undefined ? data.facadeType : current.facadeType,
        floorCount: data.floorCount !== undefined ? data.floorCount : current.floorCount,
        architecturalStyle: data.architecturalStyle !== undefined ? data.architecturalStyle : current.architecturalStyle,
        visibleSurfaces: data.visibleSurfaces !== undefined ? JSON.stringify(data.visibleSurfaces) : current.visibleSurfaces,
        naturalLightQuality: data.naturalLightQuality !== undefined ? data.naturalLightQuality : current.naturalLightQuality,
        paintableRegions: data.paintableRegions !== undefined ? JSON.stringify(data.paintableRegions) : current.paintableRegions,
        analysisState: nextState,
      },
    });

    await recordAuditEvent({
      userId: user.internalUserId,
      eventType: 'ANALYSIS_REVIEWED',
      resourceType: 'ImageAnalysisResult',
      resourceId: updated.id,
      outcome: 'SUCCESS',
      metadata: {
        projectId,
        projectImageId: imageId,
        hasModifications,
        analysisState: nextState,
        warnings,
      },
    });

    return NextResponse.json({
      analysisResult: updated,
      analysisState: nextState,
      warnings,
    });
  } catch (error: any) {
    if (error.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === 'UNAUTHORIZED_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    logger.error({ error }, '[AnalysisRoute] PATCH failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
