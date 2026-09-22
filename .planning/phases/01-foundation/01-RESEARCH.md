# Phase 01: Foundation - Research

**Phase:** 01-foundation  
**Researched:** 2026-09-22  
**Status:** Completed (Audited against Requirements.md, Design.md, Tasks.md)

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **DEC-01**: Next.js 14 (App Router) with React 18, TypeScript, and Tailwind CSS.
- **DEC-02**: Microsoft Entra External ID is the sole identity authority. Auth.js v5 acts purely as the OIDC client session layer. Passwords are never stored in the application database.
- **DEC-03**: Azure SQL Database (SQL Server) with Prisma 5 ORM (`provider = "sqlserver"`). All 23 models from Design §4.1–§4.23 must be created.
- **DEC-04**: Azure Blob Storage private containers (`project-images`, `generated-images`) accessed via pre-signed time-limited SAS tokens. Direct public access is disabled.
- **DEC-05**: Azure Cache for Redis and BullMQ for asynchronous job queues (`image-analysis-queue`, `recommendation-queue` per Tasks §0.4.2) and sliding-window rate limiting. `visualization-queue` belongs to Wave 3.
- **REQ-15**: Redis-backed sliding-window rate limiting middleware.
- **REQ-16**: System security with zero credentials in code; secrets loaded from Azure Key Vault via environment configuration.
- **REQ-18**: Tamper-evident structured audit logging recording authentication, authorization, and administrative events.

### the agent's Discretion
- Local development workflow with docker-compose for SQL Server, Redis, and Azurite to enable rapid development and offline integration testing.
- Unit and integration testing framework (Vitest with mock Azure Blob / Redis clients).
- Environment variable schema validation using Zod.

### Deferred Ideas
- Wave 1 MVP functional implementations (geocoding client, Open-Meteo client, Gemini Vision analysis runner, recommendation UI).
- Wave 3 features (`visualization-queue`, `visualization-worker.ts`, Gemini Image Generation).
- Mappls Geocoding API client (deferred to v2).
- SAM2 wall segmentation (deferred to v2).

---

## Standard Stack

| Category | Recommended Package | Version / Tag | Provenance | Purpose |
|----------|---------------------|---------------|------------|---------|
| Framework | `next` | `^14.2.0` | `[VERIFIED: npm registry]` | App Router, React Server Components, REST API routes |
| Language | `typescript` | `^5.4.0` | `[VERIFIED: npm registry]` | Static type checking and contracts |
| Styling | `tailwindcss`, `postcss`, `autoprefixer` | `^3.4.0` | `[VERIFIED: npm registry]` | Utility-first CSS styling |
| ORM | `prisma`, `@prisma/client` | `^5.14.0` | `[VERIFIED: npm registry]` | Microsoft SQL Server relational modeling and migrations (23 models) |
| Object Storage | `@azure/storage-blob` | `^12.18.0` | `[VERIFIED: npm registry]` | Azure Blob container operations and SAS token generation |
| Identity & Session | `next-auth` (Auth.js v5) | `^5.0.0-beta` | `[VERIFIED: npm registry]` | OIDC client for Entra External ID and session cookies |
| Queue / Async | `bullmq` | `^5.7.0` | `[VERIFIED: npm registry]` | Redis-backed queues (`image-analysis-queue`, `recommendation-queue`) |
| Cache & Redis | `ioredis` | `^5.4.0` | `[VERIFIED: npm registry]` | Redis client for rate limiting and BullMQ connection |
| Validation | `zod` | `^3.23.0` | `[VERIFIED: npm registry]` | Runtime environment variable and input validation |
| Logging | `pino`, `pino-pretty` | `^11.0.0` | `[VERIFIED: npm registry]` | Fast structured JSON logging with request correlation |
| Testing | `vitest`, `@testing-library/react` | `^1.6.0` | `[VERIFIED: npm registry]` | Fast TypeScript unit and integration testing |

---

## Architecture Patterns

### 1. Prisma Client Singleton in Next.js
In Next.js development mode, hot-reloading instantiates new Node.js modules repeatedly, which quickly exhausts database connection pools if a global singleton pattern is not used.

```typescript
// src/lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 2. SQL Server Specific Prisma Types across 23 Models
When defining Prisma models for Azure SQL Database:
- UUID primary keys: `@id @default(uuid())` maps to `uniqueidentifier` or `NVarChar(36)`.
- Free text: map strings to `@db.NVarChar(max)` or `@db.NVarChar(255)`.
- Floating-point calculations: use `@db.Float` for coordinates and scores.
- Timestamps: use `DateTime @default(now())` mapping to `datetime2`.
- Models: All 23 models defined in Design §4.1–§4.23 (Users, UserProfiles, Projects, ProjectLocations, ProjectImages, ImageAnalysisResults, PaintBrands, PaintProducts, PaintShades, PaintShadeSources, ClimateProfiles, ClimateObservations, RecommendationRuns, Recommendations, RecommendationFactors, Dealers, DealerBrands, DealerVerificationRecords, ImageGenerationJobs, GeneratedImages, GeminiFallbackPrompts, DataSources, AuditLogs).

### 3. Azure Blob Storage SAS Token Generation
To adhere to the zero-public-access constraint (DEC-04 / CON-03), clients never upload directly via public endpoints. The server generates time-limited Shared Access Signature (SAS) tokens with write-only permissions:

```typescript
// src/lib/storage/azure-blob.ts
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';

export function getUploadSasUrl(containerName: string, blobName: string, expiresInMinutes = 15): string {
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
  const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);

  const expiresOn = new Date(new Date().valueOf() + expiresInMinutes * 60 * 1000);
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
    sharedKeyCredential
  ).toString();

  return `https://${account}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
}
```

### 4. BullMQ Queue & Worker Architecture (Wave 0 Scope)
BullMQ requires an `ioredis` connection instance with `maxRetriesPerRequest: null`.
Queues configured in Wave 0 (Foundation) per Tasks §0.4.2:
- `image-analysis-queue`: Receives uploaded image analysis jobs.
- `recommendation-queue`: Receives recommendation calculation runs.
- `analysis-worker.ts`: Worker process entrypoint dequeuing from `image-analysis-queue`.
- *Note:* `visualization-queue` belongs strictly to Wave 3 (Tasks §3.2.1) and is not implemented in Wave 0.

```typescript
// src/lib/queue/bullmq.ts
import { Queue, Worker, Job } from 'bullmq';
import { getRedisConnection } from '../redis/client';

const connection = getRedisConnection();

export const imageAnalysisQueue = new Queue('image-analysis-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const recommendationQueue = new Queue('recommendation-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
```

### 5. Redis Sliding-Window Rate Limiting
Rate limiting uses Redis sorted sets (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`, `EXPIRE`) to enforce exact sliding window intervals per Design §17.

---

## Source Contradictions & Architecture Gaps Flagged

1. **ImageAnalysisResult.projectImageId Contradiction**:
   - In Design §4.6, `projectImageId String @unique` is non-null and references `ProjectImage`.
   - In Design §22, Wave 2 project-level synthesis is specified as: "stored as a special ImageAnalysisResult with no associated ProjectImage (projectImageId = null)".
   - *Impact*: In SQL Server via Prisma, non-null `String @unique` will prevent inserting null `projectImageId` records in Wave 2. Requires source document resolution.

2. **ScoringWeights Model Absence**:
   - Requirements (Req 9.3, 18.2) and Design §7.3 refer to active, versioned `ScoringWeights`.
   - Design §4 defines exactly 23 models and does NOT include a `ScoringWeights` table; `RecommendationRun` (§4.13) only stores `scoringWeightsVersion String`.
   - *Impact*: No 24th table may be silently created in Wave 0 without explicit source clarification.

3. **DealerBrands.brandId Relation**:
   - In Design §4.17, `DealerBrand` has `brandId String` without a Prisma `@relation` to `PaintBrand`.

4. **Project Archive HTTP Method**:
   - Design §6.1 specifies `POST /api/v1/projects/:id/archive`.
   - Design §23.1 specifies `PATCH /api/v1/projects/:id/archive`.

---

## Don't Hand-Roll

| Capability | Recommended Solution | Why Not Custom |
|------------|----------------------|----------------|
| Database Migrations | `prisma migrate dev` / `prisma migrate deploy` | Manual SQL migration tracking is error-prone and misses referential integrity checks. |
| Blob SAS Signing | Official `@azure/storage-blob` SDK | Manual HMAC-SHA256 signature string calculation has subtle canonicalization pitfalls. |
| Job Retry / Backoff | `BullMQ` with Redis | Custom queue polling lacks distributed locks, atomic deduplication, and crash recovery. |
| Sliding Window Limits | Redis Sorted Sets (`ioredis`) | In-memory Node counters do not work across horizontal Azure App Service instances. |
| Env Var Parsing | `Zod` validation | Raw `process.env` lookups allow missing config to fail silently at deep runtime call stacks. |

---

## Plan Decomposition Guidance

Phase 1 is organized into 4 focused plans:
1. **Plan 01-01**: Next.js 14 baseline, TypeScript, Tailwind CSS, environment validation schema (`env.ts`), ESLint/Prettier/Husky hooks, and GitHub Actions CI/CD workflows.
2. **Plan 01-02**: Complete Prisma 5 schema for Microsoft SQL Server defining all 23 models from Design §4, initial migration generation, seed script (4 PaintBrands + DataSources), and database client singleton.
3. **Plan 01-03**: Azure Blob Storage client with SAS generator, Redis connection wrapper, BullMQ queues (`image-analysis-queue`, `recommendation-queue`) and `analysis-worker.ts` scaffold, structured JSON logging with correlation IDs, and sliding-window rate limiting middleware.
4. **Plan 01-04**: Authentication foundation (Task 0.5): Microsoft Entra External ID configuration, Auth.js v5 OIDC provider setup, `/api/v1/*` session protection middleware, post-login callback User upsert and AuditLog events, and `AUTH_PROVIDER=EntraExternalID` security invariant test suite.
