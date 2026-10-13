import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processImageAnalysisJob } from '@/workers/analysis-worker';
import {
  GeminiAnalysisClient,
  GeminiSafetyRefusalError,
  GeminiRetryableError,
} from '@/lib/vision/gemini-client';
import { prisma } from '@/lib/db/prisma';
import * as auditModule from '@/lib/audit';
import * as blobStorage from '@/lib/storage/blob';
import { ImageProcessingState, AnalysisState } from '@/types/enums';

vi.mock('@/lib/redis/client', () => ({
  getRedisClient: vi.fn().mockReturnValue({}),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation((name, options) => ({
    name,
    options,
    add: vi.fn(),
  })),
  Worker: vi.fn().mockImplementation((name, processor, options) => ({
    name,
    processor,
    options,
    on: vi.fn(),
  })),
}));

vi.mock('@/lib/env', () => ({
  env: {
    GEMINI_API_KEY: 'test-gemini-key',
    IMAGE_ANALYSIS_MODEL: 'gemini-1.5-pro',
    AZURE_STORAGE_CONTAINER_NAME: 'test-container',
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    projectImage: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    imageAnalysisResult: {
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

vi.mock('@/lib/storage/blob', () => ({
  getBlobServiceClient: vi.fn(() => ({
    getContainerClient: vi.fn(() => ({
      getBlockBlobClient: vi.fn(() => ({
        downloadToBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-image-bytes')),
      })),
    })),
  })),
}));

describe('Gemini Vision Analysis & Worker Pipeline (02-03 Task 2)', () => {
  const projectImageId = 'img-uuid-12345';
  const projectId = 'proj-uuid-67890';
  const storageKey = 'projects/proj-uuid-67890/test-img.jpg';
  const mimeType = 'image/jpeg';

  const mockJob: any = {
    id: 'job-101',
    data: {
      projectImageId,
      projectId,
      storageKey,
      mimeType,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully processes image and creates ImageAnalysisResult strictly linked 1:1 to ProjectImage', async () => {
    (prisma.projectImage.findUnique as any).mockResolvedValue({
      id: projectImageId,
      projectId,
      storageKey,
      mimeType,
      processingState: ImageProcessingState.QUEUED,
      retryCount: 0,
      project: { userId: 'user-owner' },
    });

    vi.spyOn(GeminiAnalysisClient, 'analyzeImage').mockResolvedValue({
      spaceType: 'LIVING_ROOM',
      isInterior: true,
      facadeType: null,
      floorCount: null,
      architecturalStyle: 'CONTEMPORARY',
      visibleSurfaces: ['PLASTER', 'WOOD'],
      naturalLightQuality: 'HIGH',
      paintableRegions: ['WALLS', 'CEILING'],
      confidence: {
        spaceType: 0.95,
        architecturalStyle: 0.9,
        surfaces: 0.88,
        overall: 0.91,
      },
      rawJson: '{"spaceType":"LIVING_ROOM"}',
    });

    await processImageAnalysisJob(mockJob);

    // Verify ProjectImage transitioned to PROCESSING then COMPLETED
    expect(prisma.projectImage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectImageId },
        data: { processingState: ImageProcessingState.PROCESSING },
      })
    );
    expect(prisma.projectImage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectImageId },
        data: { processingState: ImageProcessingState.COMPLETED },
      })
    );

    // Verify ImageAnalysisResult was upserted with non-null projectImageId and AI_INFERRED
    expect(prisma.imageAnalysisResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectImageId },
        create: expect.objectContaining({
          projectImageId,
          spaceType: 'LIVING_ROOM',
          isInterior: true,
          architecturalStyle: 'CONTEMPORARY',
          analysisState: AnalysisState.AI_INFERRED,
        }),
      })
    );

    // Verify AuditLog written
    expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'IMAGE_ANALYSIS_COMPLETED',
        resourceId: projectImageId,
      })
    );
  });

  it('handles safety refusal: transitions immediately to FAILED without retry and writes SAFETY_REFUSAL AuditLog', async () => {
    (prisma.projectImage.findUnique as any).mockResolvedValue({
      id: projectImageId,
      projectId,
      storageKey,
      mimeType,
      processingState: ImageProcessingState.QUEUED,
      retryCount: 0,
      project: { userId: 'user-owner' },
    });

    vi.spyOn(GeminiAnalysisClient, 'analyzeImage').mockRejectedValue(
      new GeminiSafetyRefusalError('Prompt refused due to safety rating', 'HARM_CATEGORY_DANGEROUS_CONTENT')
    );

    // Should NOT throw (so BullMQ won't retry)
    await expect(processImageAnalysisJob(mockJob)).resolves.not.toThrow();

    // Verify ProjectImage transitioned to FAILED
    expect(prisma.projectImage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectImageId },
        data: { processingState: ImageProcessingState.FAILED },
      })
    );

    // Verify safety refusal reason persisted in ImageAnalysisResult
    expect(prisma.imageAnalysisResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectImageId },
        create: expect.objectContaining({
          projectImageId,
          safetyRefusalReason: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        }),
      })
    );

    // Verify AuditLog contains SAFETY_REFUSAL
    expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SAFETY_REFUSAL',
        metadata: expect.objectContaining({
          reason: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        }),
      })
    );
  });

  it('handles transient errors: increments retryCount and transitions to RETRYING when retries < 3', async () => {
    (prisma.projectImage.findUnique as any).mockResolvedValue({
      id: projectImageId,
      projectId,
      storageKey,
      mimeType,
      processingState: ImageProcessingState.PROCESSING,
      retryCount: 1, // retry attempt 1
      project: { userId: 'user-owner' },
    });

    vi.spyOn(GeminiAnalysisClient, 'analyzeImage').mockRejectedValue(
      new GeminiRetryableError('Rate limit exceeded (429)')
    );

    // Should rethrow to trigger BullMQ exponential backoff
    await expect(processImageAnalysisJob(mockJob)).rejects.toThrow(/Rate limit exceeded/i);

    expect(prisma.projectImage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectImageId },
        data: {
          retryCount: 2,
          processingState: ImageProcessingState.RETRYING,
        },
      })
    );
  });

  it('exhausted retries transitions state to FAILED', async () => {
    (prisma.projectImage.findUnique as any).mockResolvedValue({
      id: projectImageId,
      projectId,
      storageKey,
      mimeType,
      processingState: ImageProcessingState.RETRYING,
      retryCount: 2, // on 3rd attempt, retries will be exhausted
      project: { userId: 'user-owner' },
    });

    vi.spyOn(GeminiAnalysisClient, 'analyzeImage').mockRejectedValue(
      new GeminiRetryableError('Gateway timeout (504)')
    );

    // Should complete cleanly and mark FAILED
    await processImageAnalysisJob(mockJob);

    expect(prisma.projectImage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectImageId },
        data: {
          retryCount: 3,
          processingState: ImageProcessingState.FAILED,
        },
      })
    );
  });

  it('preserves queue boundary: contains no references to visualization-queue or image generation', () => {
    // Assert architectural queue discipline
    const workerCode = processImageAnalysisJob.toString();
    expect(workerCode).not.toContain('visualization-queue');
    expect(workerCode).not.toContain('ImageGenerationJob');
  });
});
