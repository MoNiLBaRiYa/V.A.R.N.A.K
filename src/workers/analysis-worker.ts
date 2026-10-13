import { Worker, Job } from 'bullmq';
import { getRedisClient } from '@/lib/redis/client';
import { IMAGE_ANALYSIS_QUEUE_NAME, ImageAnalysisJobData } from '@/lib/queue/bullmq';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getBlobServiceClient } from '@/lib/storage/blob';
import { recordAuditEvent } from '@/lib/audit';
import {
  GeminiAnalysisClient,
  GeminiSafetyRefusalError,
  GeminiRetryableError,
} from '@/lib/vision/gemini-client';
import { ImageProcessingState, AnalysisState } from '@/types/enums';

/**
 * Downloads image buffer from Azure Blob Storage using private block blob client
 */
async function downloadImageBuffer(storageKey: string): Promise<Buffer> {
  const containerName = env.AZURE_STORAGE_CONTAINER_NAME || 'project-images';
  const blobService = getBlobServiceClient();
  const containerClient = blobService.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(storageKey);

  return await blockBlobClient.downloadToBuffer();
}

/**
 * Processes an individual Image Analysis job (§REQ-06, Tasks 1.6.1-1.6.5)
 */
export async function processImageAnalysisJob(job: Job<ImageAnalysisJobData>) {
  const { projectImageId, projectId, storageKey, mimeType } = job.data;
  logger.info({ jobId: job.id, projectImageId, projectId }, '[AnalysisWorker] Processing image analysis');

  const projectImage = await prisma.projectImage.findUnique({
    where: { id: projectImageId },
    include: { project: true },
  });

  if (!projectImage) {
    logger.error({ projectImageId }, '[AnalysisWorker] ProjectImage not found');
    return;
  }

  // If image was marked DELETED while queued, abort processing
  if (projectImage.processingState === ImageProcessingState.DELETED) {
    logger.info({ projectImageId }, '[AnalysisWorker] Image marked DELETED; skipping analysis');
    return;
  }

  // Transition state to PROCESSING
  await prisma.projectImage.update({
    where: { id: projectImageId },
    data: { processingState: ImageProcessingState.PROCESSING },
  });

  try {
    const buffer = await downloadImageBuffer(storageKey);
    const analysis = await GeminiAnalysisClient.analyzeImage(buffer, mimeType);

    // Save ImageAnalysisResult (strict 1:1 non-null foreign key with ProjectImage)
    await prisma.imageAnalysisResult.upsert({
      where: { projectImageId },
      update: {
        spaceType: analysis.spaceType,
        isInterior: analysis.isInterior,
        facadeType: analysis.facadeType,
        floorCount: analysis.floorCount,
        architecturalStyle: analysis.architecturalStyle,
        visibleSurfaces: JSON.stringify(analysis.visibleSurfaces),
        naturalLightQuality: analysis.naturalLightQuality,
        paintableRegions: JSON.stringify(analysis.paintableRegions),
        rawGeminiResponse: analysis.rawJson,
        analysisState: AnalysisState.AI_INFERRED,
        safetyRefusalReason: null,
        analysisError: null,
      },
      create: {
        projectImageId,
        spaceType: analysis.spaceType,
        isInterior: analysis.isInterior,
        facadeType: analysis.facadeType,
        floorCount: analysis.floorCount,
        architecturalStyle: analysis.architecturalStyle,
        visibleSurfaces: JSON.stringify(analysis.visibleSurfaces),
        naturalLightQuality: analysis.naturalLightQuality,
        paintableRegions: JSON.stringify(analysis.paintableRegions),
        rawGeminiResponse: analysis.rawJson,
        analysisState: AnalysisState.AI_INFERRED,
      },
    });

    // Mark ProjectImage as COMPLETED
    await prisma.projectImage.update({
      where: { id: projectImageId },
      data: { processingState: ImageProcessingState.COMPLETED },
    });

    await recordAuditEvent({
      userId: projectImage.project?.userId,
      eventType: 'IMAGE_ANALYSIS_COMPLETED',
      resourceType: 'ImageAnalysisResult',
      resourceId: projectImageId,
      outcome: 'SUCCESS',
      metadata: {
        projectId,
        spaceType: analysis.spaceType,
        architecturalStyle: analysis.architecturalStyle,
      },
    });

    logger.info({ projectImageId }, '[AnalysisWorker] Image analysis completed successfully');
  } catch (err: any) {
    // 1. Safety Refusal: Transition directly to FAILED without retrying (§REQ-06, Design §10.2)
    if (err instanceof GeminiSafetyRefusalError) {
      logger.warn({ projectImageId, reason: err.refusalReason }, '[AnalysisWorker] Gemini safety refusal detected');

      await prisma.projectImage.update({
        where: { id: projectImageId },
        data: { processingState: ImageProcessingState.FAILED },
      });

      await prisma.imageAnalysisResult.upsert({
        where: { projectImageId },
        update: {
          safetyRefusalReason: err.refusalReason,
          analysisError: err.message,
          analysisState: AnalysisState.AI_INFERRED,
        },
        create: {
          projectImageId,
          safetyRefusalReason: err.refusalReason,
          analysisError: err.message,
          analysisState: AnalysisState.AI_INFERRED,
        },
      });

      await recordAuditEvent({
        userId: projectImage.project?.userId,
        eventType: 'SAFETY_REFUSAL',
        resourceType: 'ProjectImage',
        resourceId: projectImageId,
        outcome: 'DENIED',
        metadata: {
          projectId,
          reason: err.refusalReason,
        },
      });

      return; // Do NOT throw, prevents BullMQ retry
    }

    // 2. Transient / Retryable errors
    const currentRetries = (projectImage.retryCount || 0) + 1;
    logger.warn({ projectImageId, currentRetries, err: err.message }, '[AnalysisWorker] Analysis attempt failed');

    if (currentRetries < 3) {
      await prisma.projectImage.update({
        where: { id: projectImageId },
        data: {
          retryCount: currentRetries,
          processingState: ImageProcessingState.RETRYING,
        },
      });
      // Throw error to trigger BullMQ exponential backoff
      throw err;
    } else {
      // Retries exhausted -> Transition to FAILED
      await prisma.projectImage.update({
        where: { id: projectImageId },
        data: {
          retryCount: currentRetries,
          processingState: ImageProcessingState.FAILED,
        },
      });

      await prisma.imageAnalysisResult.upsert({
        where: { projectImageId },
        update: {
          analysisError: err.message,
        },
        create: {
          projectImageId,
          analysisError: err.message,
          analysisState: AnalysisState.AI_INFERRED,
        },
      });

      await recordAuditEvent({
        userId: projectImage.project?.userId,
        eventType: 'IMAGE_ANALYSIS_FAILED',
        resourceType: 'ProjectImage',
        resourceId: projectImageId,
        outcome: 'FAILURE',
        metadata: {
          projectId,
          error: err.message,
          retries: currentRetries,
        },
      });
    }
  }
}

export const analysisWorker = new Worker<ImageAnalysisJobData>(
  IMAGE_ANALYSIS_QUEUE_NAME,
  processImageAnalysisJob,
  {
    connection: getRedisClient(),
    concurrency: 5,
  }
);

analysisWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '[AnalysisWorker] Job completed');
});

analysisWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, '[AnalysisWorker] Job failed');
});
