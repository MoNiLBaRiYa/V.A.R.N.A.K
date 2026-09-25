import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Azure Blob Storage
  AZURE_STORAGE_ACCOUNT_NAME: z.string().min(1, 'AZURE_STORAGE_ACCOUNT_NAME is required'),
  AZURE_STORAGE_ACCOUNT_KEY: z.string().min(1, 'AZURE_STORAGE_ACCOUNT_KEY is required'),
  AZURE_STORAGE_CONTAINER_NAME: z.string().default('project-images'),
  AZURE_STORAGE_GENERATED_CONTAINER_NAME: z.string().default('generated-images'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Microsoft Entra External ID & NextAuth
  ENTRA_TENANT_ID: z.string().min(1, 'ENTRA_TENANT_ID is required'),
  ENTRA_CLIENT_ID: z.string().min(1, 'ENTRA_CLIENT_ID is required'),
  ENTRA_CLIENT_SECRET: z.string().min(1, 'ENTRA_CLIENT_SECRET is required'),
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET must be at least 16 characters'),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),

  // AI & Geocoding APIs
  GEMINI_API_KEY: z.string().optional(),
  IMAGE_ANALYSIS_MODEL: z.string().default('gemini-1.5-pro'),
  GOOGLE_GEOCODING_API_KEY: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),

  // Email
  EMAIL_PROVIDER: z.enum(['sendgrid', 'azure_communication', 'smtp', 'console']).default('console'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@varnak.in'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(rawEnv: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const formattedErrors = result.error.flatten().fieldErrors;
    const errorDetails = Object.entries(formattedErrors)
      .map(([field, errors]) => `  - ${field}: ${(errors ?? []).join(', ')}`)
      .join('\n');

    throw new Error(
      `[CRITICAL] Invalid application environment configuration:\n${errorDetails}\nCheck your .env file or Azure Key Vault configuration.`
    );
  }
  return result.data;
}

// In test environment, allow lazy loading or fallback to avoid throwing during tests that don't need all keys
export const env: Env =
  process.env.NODE_ENV === 'test'
    ? (envSchema.partial().parse(process.env) as Env)
    : parseEnv(process.env);
