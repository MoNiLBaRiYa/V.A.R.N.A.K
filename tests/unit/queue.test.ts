import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/redis/client', () => ({
  getRedisClient: vi.fn().mockReturnValue({}),
}));

vi.mock('bullmq', () => {
  return {
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
  };
});

describe('BullMQ Queue Setup (src/lib/queue/bullmq.ts)', () => {
  it('initializes image-analysis-queue and recommendation-queue', async () => {
    const { imageAnalysisQueue, recommendationQueue, IMAGE_ANALYSIS_QUEUE_NAME, RECOMMENDATION_QUEUE_NAME } =
      await import('@/lib/queue/bullmq');

    expect(IMAGE_ANALYSIS_QUEUE_NAME).toBe('image-analysis-queue');
    expect(RECOMMENDATION_QUEUE_NAME).toBe('recommendation-queue');
    expect(imageAnalysisQueue.name).toBe('image-analysis-queue');
    expect(recommendationQueue.name).toBe('recommendation-queue');
  });

  it('enforces exponential retry backoff on queues', async () => {
    const { imageAnalysisQueue } = await import('@/lib/queue/bullmq');
    expect((imageAnalysisQueue as any).options.defaultJobOptions?.attempts).toBe(3);
    expect((imageAnalysisQueue as any).options.defaultJobOptions?.backoff).toEqual({
      type: 'exponential',
      delay: 2000,
    });
  });
});
