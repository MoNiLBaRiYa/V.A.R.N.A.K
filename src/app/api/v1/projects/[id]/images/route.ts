import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService } from '@/lib/projects/service';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { validateImageBuffer, uploadImageToStorage, ImageValidationError } from '@/lib/images/upload-service';
import { enqueueImageAnalysis } from '@/lib/queue/bullmq';
import { recordAuditEvent } from '@/lib/audit';
import { ImageProcessingState, ProjectStatus } from '@/types/enums';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: { id: string };
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

    const projectId = params.id;
    await ProjectService.getProjectById(user.internalUserId, projectId);

    const images = await prisma.projectImage.findMany({
      where: {
        projectId,
        processingState: { not: ImageProcessingState.DELETED },
      },
      include: {
        analysisResult: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ images });
  } catch (error: any) {
    if (error.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === 'UNAUTHORIZED_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    logger.error({ error }, '[ImageRoute] GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const projectId = params.id;
    const project = await ProjectService.getProjectById(user.internalUserId, projectId);

    // Conflict check on archived projects (§REQ-02, REQ-05)
    if (project.status === ProjectStatus.ARCHIVED) {
      return NextResponse.json(
        { error: 'Cannot upload images to an archived project', code: 'PROJECT_ARCHIVED' },
        { status: 409 }
      );
    }

    // Centralized rate limiting (20 uploads/day/user) (§REQ-05, REQ-18)
    const rateLimit = await checkRateLimit(`image_upload:${user.internalUserId}`, RATE_LIMIT_CONFIGS.IMAGE_UPLOAD);
    if (!rateLimit.success) {
      logger.warn({ userId: user.internalUserId }, '[ImageRoute] Rate limit exceeded');
      return NextResponse.json(
        {
          error: 'Daily upload limit exceeded. You can upload up to 20 images per day.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.reset,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.reset),
          },
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing image file in multipart form field "file"', code: 'MISSING_FILE' },
        { status: 400 }
      );
    }

    const fileName = (file as any).name || 'property_image.jpg';
    const declaredMimeType = file.type || 'image/jpeg';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate magic bytes, mime, size
    const validatedImage = validateImageBuffer(buffer, declaredMimeType, fileName);

    // Upload to Azure Blob Storage
    const { storageKey } = await uploadImageToStorage(projectId, validatedImage);

    // Create ProjectImage record with initial state UPLOADED
    const projectImage = await prisma.projectImage.create({
      data: {
        projectId,
        storageKey,
        originalFileName: validatedImage.sanitizedFileName,
        mimeType: validatedImage.mimeType,
        fileSizeBytes: validatedImage.fileSizeBytes,
        processingState: ImageProcessingState.UPLOADED,
      },
    });

    // Enqueue to BullMQ image-analysis-queue (only image analysis queue, no visualization queue)
    await enqueueImageAnalysis({
      projectImageId: projectImage.id,
      projectId,
      storageKey,
      mimeType: validatedImage.mimeType,
    });

    // Update state to QUEUED
    const updatedImage = await prisma.projectImage.update({
      where: { id: projectImage.id },
      data: { processingState: ImageProcessingState.QUEUED },
    });

    await recordAuditEvent({
      userId: user.internalUserId,
      eventType: 'IMAGE_UPLOADED',
      resourceType: 'ProjectImage',
      resourceId: projectImage.id,
      outcome: 'SUCCESS',
      metadata: {
        projectId,
        storageKey,
        fileSizeBytes: validatedImage.fileSizeBytes,
      },
    });

    return NextResponse.json({ image: updatedImage }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }
    if (error.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === 'UNAUTHORIZED_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    logger.error({ error }, '[ImageRoute] POST failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
