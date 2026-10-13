import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateImageBuffer, ImageValidationError } from '@/lib/images/upload-service';
import { ProjectStatus, ImageProcessingState } from '@/types/enums';

vi.mock('@/lib/env', () => ({
  env: {
    AZURE_STORAGE_CONTAINER_NAME: 'test-images',
    AZURE_STORAGE_ACCOUNT_NAME: 'teststorage',
    AZURE_STORAGE_ACCOUNT_KEY: 'testkey',
    RATE_LIMIT_UPLOADS_PER_DAY: 20,
  },
}));

describe('Image Upload Validation & Constraints (02-03 Task 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates a proper JPEG buffer with FF D8 FF magic bytes', () => {
    // Construct JPEG magic bytes FF D8 FF
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const validated = validateImageBuffer(jpegBuffer, 'image/jpeg', 'living_room.jpg');

    expect(validated.mimeType).toBe('image/jpeg');
    expect(validated.sanitizedFileName).toBe('living_room.jpg');
    expect(validated.fileSizeBytes).toBe(jpegBuffer.length);
  });

  it('validates a proper PNG buffer with 89 50 4E 47 magic bytes', () => {
    // Construct PNG magic bytes 89 50 4E 47
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validated = validateImageBuffer(pngBuffer, 'image/png', 'facade.png');

    expect(validated.mimeType).toBe('image/png');
    expect(validated.sanitizedFileName).toBe('facade.png');
  });

  it('validates a proper WebP buffer with RIFF...WEBP magic bytes', () => {
    const webpHeader = Buffer.from('RIFF1234WEBP', 'ascii');
    const validated = validateImageBuffer(webpHeader, 'image/webp', 'exterior.webp');

    expect(validated.mimeType).toBe('image/webp');
    expect(validated.sanitizedFileName).toBe('exterior.webp');
  });

  it('rejects unsupported MIME types (e.g. image/gif or application/pdf)', () => {
    const fakeBuffer = Buffer.from('GIF89a...');
    expect(() => validateImageBuffer(fakeBuffer, 'image/gif', 'animation.gif')).toThrow(
      /Unsupported image MIME type/i
    );
  });

  it('rejects files exceeding maximum size of 10MB', () => {
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    // Even with JPEG magic bytes, should reject for size
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;

    expect(() => validateImageBuffer(oversizedBuffer, 'image/jpeg', 'giant.jpg')).toThrow(
      /exceeds maximum allowed limit of 10 MB/i
    );
  });

  it('rejects spoofed files where declared MIME does not match magic bytes', () => {
    // PNG bytes declared as JPEG
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => validateImageBuffer(pngBuffer, 'image/jpeg', 'spoofed.jpg')).toThrow(
      /do not match declared MIME type/i
    );
  });

  it('rejects corrupted files with unrecognizable magic bytes', () => {
    const corruptBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(() => validateImageBuffer(corruptBuffer, 'image/jpeg', 'corrupt.jpg')).toThrow(
      /Corrupt file or unsupported image header/i
    );
  });

  it('sanitizes file names containing illegal or path-traversal characters', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const validated = validateImageBuffer(jpegBuffer, 'image/jpeg', '../../../etc/passwd.jpg');
    expect(validated.sanitizedFileName).not.toContain('/');
    expect(validated.sanitizedFileName).toContain('passwd.jpg');
  });
});
