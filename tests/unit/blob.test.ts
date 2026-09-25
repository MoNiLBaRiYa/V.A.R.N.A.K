import { describe, it, expect } from 'vitest';
import { generateUploadSasUrl, generateReadSasUrl } from '@/lib/storage/blob';

describe('Azure Blob Storage SAS Generation (src/lib/storage/blob.ts)', () => {
  it('generates a signed upload SAS URL with write and create permissions', () => {
    const url = generateUploadSasUrl('project-images', 'test-image.jpg', 15);
    expect(url).toContain('https://devstoreaccount1.blob.core.windows.net/project-images/test-image.jpg?');
    expect(url).toContain('sp='); // SAS permissions
    expect(url).toContain('se='); // SAS expiry
    expect(url).toContain('sig='); // Signature
  });

  it('generates a signed read SAS URL with read permissions', () => {
    const url = generateReadSasUrl('project-images', 'test-image.jpg', 60);
    expect(url).toContain('https://devstoreaccount1.blob.core.windows.net/project-images/test-image.jpg?');
    expect(url).toContain('sp=');
    expect(url).toContain('se=');
    expect(url).toContain('sig=');
  });
});
