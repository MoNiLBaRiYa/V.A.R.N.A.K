import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
import { env } from '@/lib/env';

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function getStorageAccountName(): string {
  return env.AZURE_STORAGE_ACCOUNT_NAME || process.env.AZURE_STORAGE_ACCOUNT_NAME || 'devstoreaccount1';
}

function getSharedKeyCredential(): StorageSharedKeyCredential {
  const account = getStorageAccountName();
  const accountKey =
    env.AZURE_STORAGE_ACCOUNT_KEY ||
    process.env.AZURE_STORAGE_ACCOUNT_KEY ||
    'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

  return new StorageSharedKeyCredential(account, accountKey);
}

export function getBlobServiceClient(): BlobServiceClient {
  const credential = getSharedKeyCredential();
  const account = getStorageAccountName();
  const url = `https://${account}.blob.core.windows.net`;
  return new BlobServiceClient(url, credential);
}

export async function ensureContainerExists(containerName: string): Promise<void> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  await containerClient.createIfNotExists({
    access: undefined, // Private: no public anonymous read access
  });
}

export function generateUploadSasUrl(
  containerName: string,
  blobName: string,
  expiresInMinutes = 15
): string {
  const credential = getSharedKeyCredential();
  const account = getStorageAccountName();
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const permissions = new BlobSASPermissions();
  permissions.write = true;
  permissions.create = true;

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions,
      expiresOn,
    },
    credential
  ).toString();

  return `https://${account}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
}

export function generateReadSasUrl(
  containerName: string,
  blobName: string,
  expiresInMinutes = 60
): string {
  const credential = getSharedKeyCredential();
  const account = getStorageAccountName();
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const permissions = new BlobSASPermissions();
  permissions.read = true;

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions,
      expiresOn,
    },
    credential
  ).toString();

  return `https://${account}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
}

export async function deleteBlob(containerName: string, blobName: string): Promise<boolean> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);
  const result = await blobClient.deleteIfExists();
  return result.succeeded;
}
