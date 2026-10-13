import crypto from 'crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  getBlobServiceClient,
  ensureContainerExists,
} from '@/lib/storage/blob';

export class ImageValidationError extends Error {
  constructor(message: string, public code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ImageValidationError';
  }
}

export interface ValidatedImageInfo {
  buffer: Buffer;
  mimeType: string;
  fileSizeBytes: number;
  sanitizedFileName: string;
}

/**
 * Validates image buffer magic bytes, MIME type, and size constraints (§REQ-05, REQ-18)
 */
export function validateImageBuffer(
  buffer: Buffer,
  declaredMimeType: string,
  fileName: string
): ValidatedImageInfo {
  if (!buffer || buffer.length === 0) {
    throw new ImageValidationError('Image file cannot be empty', 'EMPTY_FILE');
  }

  if (buffer.length > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new ImageValidationError(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 10 MB`,
      'FILE_TOO_LARGE'
    );
  }

  const normalizedMime = declaredMimeType.toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime as any)) {
    throw new ImageValidationError(
      `Unsupported image MIME type: ${declaredMimeType}. Allowed formats: JPEG, PNG, WebP`,
      'INVALID_MIME_TYPE'
    );
  }

  // Magic bytes inspection
  // JPEG: FF D8 FF
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  // WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  let detectedMime: string | null = null;
  if (isJpeg) detectedMime = 'image/jpeg';
  else if (isPng) detectedMime = 'image/png';
  else if (isWebp) detectedMime = 'image/webp';

  if (!detectedMime) {
    throw new ImageValidationError(
      'Corrupt file or unsupported image header format (failed magic byte verification)',
      'MAGIC_BYTE_MISMATCH'
    );
  }

  if (detectedMime !== normalizedMime) {
    throw new ImageValidationError(
      `File contents (${detectedMime}) do not match declared MIME type (${normalizedMime})`,
      'MIME_SPOOF_DETECTED'
    );
  }

  const sanitizedFileName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);

  return {
    buffer,
    mimeType: detectedMime,
    fileSizeBytes: buffer.length,
    sanitizedFileName: sanitizedFileName || 'image.jpg',
  };
}

/**
 * Uploads validated image buffer to Azure Blob Storage private container
 */
export async function uploadImageToStorage(
  projectId: string,
  validatedImage: ValidatedImageInfo
): Promise<{ storageKey: string }> {
  const containerName = env.AZURE_STORAGE_CONTAINER_NAME || 'project-images';
  await ensureContainerExists(containerName);

  const uuid = crypto.randomUUID();
  const storageKey = `projects/${projectId}/${uuid}-${validatedImage.sanitizedFileName}`;

  const blobService = getBlobServiceClient();
  const containerClient = blobService.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(storageKey);

  logger.info({ projectId, storageKey, sizeBytes: validatedImage.fileSizeBytes }, '[UploadService] Uploading image to Azure Blob');

  await blockBlobClient.uploadData(validatedImage.buffer, {
    blobHTTPHeaders: {
      blobContentType: validatedImage.mimeType,
    },
  });

  return { storageKey };
}
