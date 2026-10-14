import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService } from '@/lib/projects/service';
import { prisma } from '@/lib/db/prisma';
import { generateReadSasUrl } from '@/lib/storage/blob';
import { env } from '@/lib/env';
import { recordAuditEvent } from '@/lib/audit';
import { ImageProcessingState } from '@/types/enums';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: { id: string; imageId: string };
}

export async function GET(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id: projectId, imageId } = params;
    await ProjectService.getProjectById(user.internalUserId, projectId);

    const image = await prisma.projectImage.findFirst({
      where: {
        id: imageId,
        projectId,
        processingState: { not: ImageProcessingState.DELETED },
      },
      include: {
        analysisResult: true,
      },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found', code: 'IMAGE_NOT_FOUND' }, { status: 404 });
    }

    const containerName = env.AZURE_STORAGE_CONTAINER_NAME || 'project-images';
    const readUrl = generateReadSasUrl(containerName, image.storageKey, 60);

    return NextResponse.json({
      image,
      readUrl,
    });
  } catch (error: any) {
    if (error.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === 'UNAUTHORIZED_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    logger.error({ error }, '[ImageDetailRoute] GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id: projectId, imageId } = params;
    await ProjectService.getProjectById(user.internalUserId, projectId);

    const image = await prisma.projectImage.findFirst({
      where: {
        id: imageId,
        projectId,
        processingState: { not: ImageProcessingState.DELETED },
      },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found', code: 'IMAGE_NOT_FOUND' }, { status: 404 });
    }

    // Soft delete: transition processingState to DELETED (§REQ-05, Tasks 1.5.7)
    await prisma.projectImage.update({
      where: { id: imageId },
      data: { processingState: ImageProcessingState.DELETED },
    });

    await recordAuditEvent({
      userId: user.internalUserId,
      eventType: 'IMAGE_DELETED',
      resourceType: 'ProjectImage',
      resourceId: imageId,
      outcome: 'SUCCESS',
      metadata: { projectId, storageKey: image.storageKey },
    });

    return NextResponse.json({ success: true, message: 'Image deleted successfully' });
  } catch (error: any) {
    if (error.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === 'UNAUTHORIZED_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    logger.error({ error }, '[ImageDetailRoute] DELETE failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
