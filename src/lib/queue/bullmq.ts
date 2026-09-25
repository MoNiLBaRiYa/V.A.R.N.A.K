import { Queue, Worker, Processor, QueueOptions, WorkerOptions } from 'bullmq';
import { getRedisClient } from '@/lib/redis/client';

const redisConnection = getRedisClient();

const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
};

// Wave 0 Foundation Queues (Task 0.4.2)
export const IMAGE_ANALYSIS_QUEUE_NAME = 'image-analysis-queue';
export const RECOMMENDATION_QUEUE_NAME = 'recommendation-queue';

export const imageAnalysisQueue = new Queue(IMAGE_ANALYSIS_QUEUE_NAME, defaultQueueOptions);
export const recommendationQueue = new Queue(RECOMMENDATION_QUEUE_NAME, defaultQueueOptions);

export interface ImageAnalysisJobData {
  projectImageId: string;
  projectId: string;
  storageKey: string;
  mimeType: string;
}

export interface RecommendationJobData {
  recommendationRunId: string;
  projectId: string;
  manufacturerId: string;
  applicationScope: string;
}

export async function enqueueImageAnalysis(
  data: ImageAnalysisJobData,
  jobId?: string
) {
  return await imageAnalysisQueue.add('analyze-image', data, {
    jobId: jobId ?? `analysis_${data.projectImageId}`,
  });
}

export async function enqueueRecommendationRun(
  data: RecommendationJobData,
  jobId?: string
) {
  return await recommendationQueue.add('compute-recommendations', data, {
    jobId: jobId ?? `rec_${data.recommendationRunId}`,
  });
}

export function createQueueWorker<T>(
  queueName: string,
  processor: Processor<T>,
  opts?: Partial<WorkerOptions>
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: redisConnection,
    concurrency: 5,
    ...opts,
  });
}
