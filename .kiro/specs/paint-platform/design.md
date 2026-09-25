# Design Document

## Climate-Aware Home Paint Recommendation & Visualization Platform

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Authentication Architecture](#3-authentication-architecture)
4. [Database Schema](#4-database-schema)
5. [Service Architecture](#5-service-architecture)
6. [API Design](#6-api-design)
7. [Recommendation Engine Design](#7-recommendation-engine-design)
8. [Palette Harmony Algorithm](#8-palette-harmony-algorithm)
9. [Filter Relaxation Sequence](#9-filter-relaxation-sequence)
10. [Image Analysis Pipeline](#10-image-analysis-pipeline)
11. [Climate Service Design](#11-climate-service-design)
12. [Geocoding Service Design](#12-geocoding-service-design)
13. [Visualization Pipeline (Wave 3)](#13-visualization-pipeline-wave-3)
14. [Dealer Discovery and Verification](#14-dealer-discovery-and-verification)
15. [Email Service Design](#15-email-service-design)
16. [Security Design](#16-security-design)
17. [Rate Limiting Design](#17-rate-limiting-design)
18. [Configuration and Secrets Management](#18-configuration-and-secrets-management)
19. [Observability and Logging](#19-observability-and-logging)
20. [Wave Architecture Summary](#20-wave-architecture-summary)
21. [Performance Targets](#21-performance-targets)
22. [Multi-Image Aggregation (Wave 2)](#22-multi-image-aggregation-wave-2)
23. [Project Archiving Design](#23-project-archiving-design)
24. [Privacy and Consent Design](#24-privacy-and-consent-design)

---

## 1. Architecture Overview

The Platform is a Next.js 14 (App Router) web application deployed on Azure App Service or Azure Container Apps. It uses a layered architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js App (App Router)                                           │
│  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │  UI Layer     │  │  API Route Layer  │  │  Auth.js Session     │ │
│  │  (React/RSC)  │  │  (/api/*)         │  │  (OIDC integration)  │ │
│  └───────────────┘  └──────────────────┘  └──────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Service Layer                                                      │
│  GeocodingService │ ClimateService │ ImageAnalysisService           │
│  RecommendationEngine │ DealerDiscoveryService │ EmailService       │
│  CrossImageAggregationService (Wave 2) │ VisualizationService (W3)  │
├─────────────────────────────────────────────────────────────────────┤
│  Data Layer                                                         │
│  Prisma ORM → Azure SQL (SQL Server)                                │
│  Azure Blob Storage (images, generated images)                      │
│  Azure Cache for Redis (session, rate limiting, queues)             │
├─────────────────────────────────────────────────────────────────────┤
│  External Services                                                  │
│  Microsoft Entra External ID │ Google Geocoding API                 │
│  Mappls Geocoding API (deferred) │ Open-Meteo / Climate API         │
│  Gemini API (image analysis + visualization) │ Google Places API    │
│  Email Provider (SendGrid / Azure Communication Services)           │
└─────────────────────────────────────────────────────────────────────┘
```

All intra-service communication is in-process within the Next.js application. Background jobs (image analysis, visualization) are processed via Redis-backed queues (BullMQ) running in a separate worker process.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript | Server and client components |
| Styling | Tailwind CSS | |
| API | Next.js API Routes (REST) | |
| ORM | Prisma 5 | Typed schema, migrations |
| Database | Azure SQL Database (SQL Server) | |
| Object Storage | Azure Blob Storage | Images, generated images |
| Cache / Queue | Azure Cache for Redis + BullMQ | Rate limiting, job queues |
| Auth | Microsoft Entra External ID + Auth.js v5 | Auth.js = OIDC session layer only |
| AI Vision | Gemini API (IMAGE_ANALYSIS_MODEL env var) | Analysis |
| AI Visualization | Gemini API (GEMINI_IMAGE_MODEL env var) | Wave 3 only |
| Email | EmailProvider abstraction (SendGrid or Azure CS) | Env-var configured |
| Geocoding | GoogleGeocodingClient (primary); MapplsGeocodingClient (deferred) | |
| Climate | Open-Meteo API (primary); Regional aggregate dataset (fallback) | |
| Dealer Discovery | Google Places API (primary) | Wave 1 |
| Dealer Verification | Official manufacturer dealer locator API (Wave 3) | |
| Secrets | Azure Key Vault + environment variables | |
| Observability | Azure Application Insights, structured JSON logs | |
| CI/CD | GitHub Actions → Azure | |

---

## 3. Authentication Architecture

### 3.1 Identity Authority

Microsoft Entra External ID is the **sole identity authority**. The Platform does NOT maintain an independent credential store, password hash store, or login endpoint.

Auth.js v5 is used exclusively as:
- An OIDC client that exchanges authorization codes with Entra External ID
- A session management layer that issues and validates application-level JWTs or database sessions

Auth.js is NOT a second identity provider and does NOT authenticate users independently.

### 3.2 Authentication Flows

**Registration:**
1. User clicks "Create Account" → redirected to Entra External ID sign-up flow
2. Entra External ID handles email collection, verification, and credential creation
3. On successful registration callback, Platform creates a User record (if new) storing: internalUserId, externalSubjectId, email, role (default: User)
4. Platform records PrivacyPolicyAcceptance and AI disclosure acceptance in UserProfiles
5. AuditLog entry written: event=REGISTRATION

**Login:**
1. User clicks "Sign In" → redirected to Entra External ID login
2. Entra External ID authenticates and returns OIDC tokens
3. Auth.js validates token, establishes application session
4. AuditLog entry: event=LOGIN

**Social Login:**
Where social identity providers (Google, Microsoft, etc.) are configured in the Entra External ID tenant, Auth.js passes through the provider selection to Entra External ID. The Platform does not implement social provider integration independently.

**Password Reset:**
Delegated entirely to Entra External ID. The Platform does NOT expose a `/api/auth/reset-password` endpoint. Users are redirected to the Entra External ID password reset flow.

**Failed Login / Lockout:**
Temporary lockout and CAPTCHA are enforced by Entra External ID tenant policy. The Platform records failed login callbacks in the AuditLog (event=LOGIN_FAILED).

**Session / Access Token Handling:**
- Auth.js maintains session cookies (HttpOnly, Secure, SameSite=Lax)
- Access tokens from Entra External ID are used for downstream API calls where required
- Sessions expire per Auth.js configuration (default: 30 days sliding)

### 3.3 Database Fields — Users Table

Stored: internalUserId (UUID, PK), externalSubjectId (Entra subject identifier), email, role (enum: USER | ADMIN), createdAt, updatedAt, lastLoginAt

NOT stored: passwords, password hashes, TOTP secrets

### 3.4 Audit Events

| Event | Trigger |
|---|---|
| REGISTRATION | New user created after Entra callback |
| EMAIL_VERIFIED | Email verification confirmed |
| LOGIN | Successful authentication |
| LOGIN_FAILED | Failed authentication callback |
| LOGOUT | Session terminated |
| PASSWORD_RESET_INITIATED | Password reset flow started |
| ROLE_CHANGED | Administrator changes user role |
| ACCOUNT_DELETED | Account deletion completed |
| SESSION_EXPIRED | Session timeout |

---

## 4. Database Schema

All migrations are managed by Prisma Migrate. Each table listed below has a corresponding Prisma schema model and migration file. There are exactly 25 database models.

### 4.1 Users

```prisma
model User {
  id               String   @id @default(uuid())
  externalSubjectId String  @unique
  email            String   @unique
  role             UserRole @default(USER)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  lastLoginAt      DateTime?
  profile          UserProfile?
  projects         Project[]
  auditLogs        AuditLog[]
}

enum UserRole { USER ADMIN }
```

### 4.2 UserProfiles

```prisma
model UserProfile {
  id                    String   @id @default(uuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id])
  privacyPolicyVersion  String
  privacyAcceptedAt     DateTime
  aiDisclosureAcceptedAt DateTime
  displayName           String?
  phoneNumber           String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### 4.3 Projects

```prisma
model Project {
  id                 String                    @id @default(uuid())
  userId             String
  user               User                      @relation(fields: [userId], references: [id])
  name               String
  description        String?
  status             ProjectStatus             @default(ACTIVE)
  archivedAt         DateTime?
  createdAt          DateTime                  @default(now())
  updatedAt          DateTime                  @updatedAt
  location           ProjectLocation?
  images             ProjectImage[]
  analysisSynthesis  ProjectAnalysisSynthesis?
  recommendationRuns RecommendationRun[]
}

enum ProjectStatus { ACTIVE ARCHIVED }
```

### 4.4 ProjectLocations

```prisma
model ProjectLocation {
  id                  String   @id @default(uuid())
  projectId           String   @unique
  project             Project  @relation(fields: [projectId], references: [id])
  rawInput            String
  resolvedAddress     String?
  latitude            Float?
  longitude           Float?
  geocodingProvider   String?
  inputProvenance     Provenance @default(USER_PROVIDED)
  coordinatesProvenance Provenance @default(DERIVED)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  climateProfile      ClimateProfile?
}
```

### 4.5 ProjectImages

```prisma
model ProjectImage {
  id             String              @id @default(uuid())
  projectId      String
  project        Project             @relation(fields: [projectId], references: [id])
  storageKey     String
  originalFileName String
  mimeType       String
  fileSizeBytes  Int
  processingState ImageProcessingState @default(UPLOADED)
  retryCount     Int                 @default(0)
  uploadedAt     DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  analysisResult ImageAnalysisResult?
  generationJobs ImageGenerationJob[]
}

enum ImageProcessingState { UPLOADED QUEUED PROCESSING RETRYING COMPLETED FAILED DELETED }
```

### 4.6 ImageAnalysisResults

```prisma
model ImageAnalysisResult {
  id                   String      @id @default(uuid())
  projectImageId       String      @unique
  projectImage         ProjectImage @relation(fields: [projectImageId], references: [id])
  spaceType            String?
  spaceTypeState       AnalysisState @default(AI_INFERRED)
  spaceTypeConfidence  Float?
  isInterior           Boolean?
  isInteriorState      AnalysisState @default(AI_INFERRED)
  isInteriorConfidence Float?
  facadeType           String?
  facadeTypeState      AnalysisState @default(AI_INFERRED)
  floorCount           Int?
  floorCountState      AnalysisState @default(AI_INFERRED)
  architecturalStyle   String?
  architecturalStyleState AnalysisState @default(AI_INFERRED)
  visibleSurfaces      Json?
  visibleSurfacesState AnalysisState @default(AI_INFERRED)
  naturalLightQuality  String?
  naturalLightState    AnalysisState @default(AI_INFERRED)
  paintableRegions     Json?
  paintableRegionsState AnalysisState @default(AI_INFERRED)
  rawGeminiResponse    Json?
  safetyRefusalReason  String?
  analysisError        String?
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
}

enum AnalysisState { AI_INFERRED USER_CONFIRMED USER_OVERRIDDEN }
```

### 4.7 PaintBrands

```prisma
model PaintBrand {
  id        String         @id @default(uuid())
  name      String         @unique  // "Asian Paints" | "Birla Opus" | "Nerolac" | "Berger Paints"
  slug      String         @unique
  isActive  Boolean        @default(true)
  products  PaintProduct[]
  dealers   DealerBrand[]
}
```

### 4.8 PaintProducts

```prisma
model PaintProduct {
  id            String   @id @default(uuid())
  brandId       String
  brand         PaintBrand @relation(fields: [brandId], references: [id])
  name          String
  formulation   String
  finishType    String
  applicationScope ApplicationScope
  surfaceCompatibility Json
  isActive      Boolean  @default(true)
  shades        PaintShade[]
}

enum ApplicationScope { INTERIOR EXTERIOR BOTH }
```

### 4.9 PaintShades

```prisma
model PaintShade {
  id            String   @id @default(uuid())
  productId     String
  product       PaintProduct @relation(fields: [productId], references: [id])
  shadeName     String
  shadeCode     String
  colourFamily  String
  hexApprox     String?
  provenance    Provenance @default(VERIFIED)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  sources       PaintShadeSource[]
  recommendations Recommendation[]
}
```

### 4.10 PaintShadeSources

```prisma
model PaintShadeSource {
  id           String   @id @default(uuid())
  shadeId      String
  shade        PaintShade @relation(fields: [shadeId], references: [id])
  dataSourceId String
  dataSource   DataSource @relation(fields: [dataSourceId], references: [id])
  retrievedAt  DateTime
  approvedBy   String?
  createdAt    DateTime @default(now())
}
```

### 4.11 ClimateProfiles

```prisma
model ClimateProfile {
  id                  String   @id @default(uuid())
  projectLocationId   String   @unique
  projectLocation     ProjectLocation @relation(fields: [projectLocationId], references: [id])
  provenance          Provenance
  dataSourceId        String
  dataSource          DataSource @relation(fields: [dataSourceId], references: [id])
  retrievedAt         DateTime
  monthlyData         ClimateObservation[]
  annualFreezeThawayCycles Int?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### 4.12 ClimateObservations

```prisma
model ClimateObservation {
  id                String         @id @default(uuid())
  climateProfileId  String
  climateProfile    ClimateProfile @relation(fields: [climateProfileId], references: [id])
  month             Int            // 1–12
  avgTempCelsius    Float
  avgHumidityPct    Float
  totalRainfallMm   Float
  avgUvIndex        Float?
  prevailingWindDir String?
  avgWindSpeedKmh   Float?
}
```

### 4.13 RecommendationRuns

```prisma
model RecommendationRun {
  id                      String               @id @default(uuid())
  projectId               String
  project                 Project              @relation(fields: [projectId], references: [id])
  manufacturerId          String
  applicationScope        ApplicationScope
  scoringWeightsVersionId String
  scoringWeightVersion    ScoringWeightVersion @relation(fields: [scoringWeightsVersionId], references: [id])
  scoringWeightsVersion   String               // Historical snapshot / version identifier string (e.g., "v1.0.0")
  relaxationApplied       Json?                // ordered list of relaxation steps applied
  paletteHarmonyApplied   Boolean              @default(false)
  status                  RunStatus            @default(PENDING)
  createdAt               DateTime             @default(now())
  completedAt             DateTime?
  recommendations         Recommendation[]
}

enum RunStatus { PENDING RUNNING COMPLETED FAILED }
```

### 4.14 Recommendations

```prisma
model Recommendation {
  id                  String   @id @default(uuid())
  runId               String
  run                 RecommendationRun @relation(fields: [runId], references: [id])
  shadeId             String
  shade               PaintShade @relation(fields: [shadeId], references: [id])
  rank                Int
  compositeScore      Float
  surfaceScope        String?  // "INTERIOR" | "EXTERIOR" (used when ApplicationScope=BOTH)
  explanation         String?
  isHarmonyReplacement Boolean @default(false)
  replacedCandidateId String?
  createdAt           DateTime @default(now())
  factors             RecommendationFactor[]
}
```

### 4.15 RecommendationFactors

```prisma
model RecommendationFactor {
  id               String         @id @default(uuid())
  recommendationId String
  recommendation   Recommendation @relation(fields: [recommendationId], references: [id])
  factorName       ScoringFactor
  score            Float
  weight           Float
  weightedScore    Float
}

enum ScoringFactor {
  CLIMATE_SUITABILITY
  INTERIOR_EXTERIOR_COMPATIBILITY
  SURFACE_COMPATIBILITY
  PRODUCT_SUITABILITY
  ARCHITECTURAL_CHARACTERISTICS
  ROOM_TYPE
  NATURAL_LIGHT
  COLOUR_FAMILY_COMPATIBILITY
  USER_PREFERENCES
}
```

### 4.16 Dealers

```prisma
model Dealer {
  id           String      @id @default(uuid())
  name         String
  address      String
  latitude     Float?
  longitude    Float?
  phone        String?
  state        DealerState @default(UNVERIFIED)
  discoverySource String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  brands       DealerBrand[]
  verificationRecords DealerVerificationRecord[]
}

enum DealerState { VERIFIED_OFFICIAL THIRD_PARTY_DISCOVERED UNVERIFIED }
```

### 4.17 DealerBrands

```prisma
model DealerBrand {
  id       String     @id @default(uuid())
  dealerId String
  dealer   Dealer     @relation(fields: [dealerId], references: [id])
  brandId  String
  brand    PaintBrand @relation(fields: [brandId], references: [id])
}
```

### 4.18 DealerVerificationRecords

```prisma
model DealerVerificationRecord {
  id           String   @id @default(uuid())
  dealerId     String
  dealer       Dealer   @relation(fields: [dealerId], references: [id])
  verifiedBy   String
  verifiedAt   DateTime
  sourceUrl    String?
  notes        String?
}
```

### 4.19 ImageGenerationJobs (Wave 3)

```prisma
model ImageGenerationJob {
  id              String               @id @default(uuid())
  projectImageId  String               // sourceImageId — explicit user selection
  projectImage    ProjectImage         @relation(fields: [projectImageId], references: [id])
  recommendationRunId String
  status          GenerationJobStatus  @default(QUEUED)
  retryCount      Int                  @default(0)
  failureReason   String?
  fallbackPromptId String?
  geminiModel     String               // value of GEMINI_IMAGE_MODEL at job creation time
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
  generatedImages GeneratedImage[]
}

enum GenerationJobStatus { QUEUED PROCESSING RETRYING COMPLETED FAILED }
```

### 4.20 GeneratedImages (Wave 3)

```prisma
model GeneratedImage {
  id          String             @id @default(uuid())
  jobId       String
  job         ImageGenerationJob @relation(fields: [jobId], references: [id])
  storageKey  String
  isIndicative Boolean           @default(false)
  createdAt   DateTime           @default(now())
}
```

### 4.21 GeminiFallbackPrompts (Wave 3)

```prisma
model GeminiFallbackPrompt {
  id        String   @id @default(uuid())
  name      String   @unique
  promptText String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 4.22 DataSources

```prisma
model DataSource {
  id            String     @id @default(uuid())
  name          String     @unique
  category      String     // "CLIMATE" | "GEOCODING" | "CATALOGUE" | "DEALER_DISCOVERY"
  providerUrl   String?
  provenance    Provenance
  lastUpdatedAt DateTime?
  isActive      Boolean    @default(true)
  climateProfiles ClimateProfile[]
  shadesSources   PaintShadeSource[]
}
```

### 4.23 AuditLogs

```prisma
model AuditLog {
  id           String   @id @default(uuid())
  userId       String?
  user         User?    @relation(fields: [userId], references: [id])
  eventType    String
  resourceType String?
  resourceId   String?
  outcome      String   // "SUCCESS" | "FAILURE"
  sourceIp     String?
  metadata     Json?
  createdAt    DateTime @default(now())
}
```

> **Note:** VerificationLogs is NOT a separate table. Dealer verification records are stored in DealerVerificationRecords. Security and compliance events are stored in AuditLogs. There is no third table.

### 4.24 ProjectAnalysisSynthesis (Wave 2)

```prisma
model ProjectAnalysisSynthesis {
  id                   String      @id @default(uuid())
  projectId            String      @unique
  project              Project     @relation(fields: [projectId], references: [id])
  spaceType            String?
  spaceTypeConfidence  Float?
  isInterior           Boolean?
  isInteriorConfidence Float?
  facadeType           String?
  floorCount           Int?
  architecturalStyle   String?
  visibleSurfaces      Json?       // Aggregated union of surfaces from contributing images
  naturalLightQuality  String?
  paintableRegions     Json?       // Aggregated paintable regions across images
  aggregationMetadata  Json?       // Conflict resolution logs, contributing image count, majority vote details
  provenance           Provenance  @default(DERIVED)
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
}
```

### 4.25 ScoringWeightVersion

```prisma
model ScoringWeightVersion {
  id                 String              @id @default(uuid())
  version            String              @unique // Semantic version tag, e.g., "v1.0.0", "default-2026"
  weights            Json                // JSON mapping of the 9 scoring factors: CLIMATE_SUITABILITY, INTERIOR_EXTERIOR_COMPATIBILITY, SURFACE_COMPATIBILITY, PRODUCT_SUITABILITY, ARCHITECTURAL_CHARACTERISTICS, ROOM_TYPE, NATURAL_LIGHT, COLOUR_FAMILY_COMPATIBILITY, USER_PREFERENCES (normalized to sum to 1.0)
  isActive           Boolean             @default(false)
  description        String?
  createdBy          String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  recommendationRuns RecommendationRun[]
}
```

### 4.26 Provenance Enum

All provenance values use the following normalized enum consistently across all tables and API responses:

```
VERIFIED | DERIVED | USER_PROVIDED | AI_INFERRED | AI_GENERATED | USER_CONFIRMED
```

Hyphenated variants (e.g., AI-INFERRED) are NOT used anywhere in the codebase.

---

## 5. Service Architecture

### 5.1 GeocodingService

```
GeocodingService
  ├── GoogleGeocodingClient   (primary provider)
  └── MapplsGeocodingClient   (deferred; not active in Wave 1)
```

**Provider selection:** GoogleGeocodingClient is the operative primary provider in Wave 1. MapplsGeocodingClient is architected as a secondary provider but is explicitly deferred — its integration is marked `deferred: true` in the provider registry. When Mappls is not active, GeocodingService uses only GoogleGeocodingClient.

**Fallback behavior:** If GoogleGeocodingClient returns a non-retryable error, GeocodingService throws a `GeocodingFailureException` with a user-facing message. When a secondary provider is active and the primary fails with a retryable error (timeout, 5xx), GeocodingService retries once on the primary, then falls back to the secondary.

**Provenance tagging:** Input = USER_PROVIDED. Resolved coordinates = DERIVED. Provider name recorded in ProjectLocation.geocodingProvider.

### 5.2 ClimateService

```
ClimateService
  ├── OpenMeteoClient         (primary)
  └── RegionalAggregateClient (fallback)
```

**Primary:** Open-Meteo API (free, no-key) for current and historical weather aggregates by lat/lon.

**Fallback:** A regional aggregate climate dataset (bundled or external static dataset). Provenance = DERIVED.

**Retry behavior:** ClimateService retries the primary source up to `CLIMATE_RETRY_COUNT` (env var, default: 3) times with exponential back-off before invoking the fallback.

**User notification:** When DERIVED provenance is set, the API response includes `climateDataNote: "Regional average climate data was used. Local conditions may vary."`. The UI displays this note prominently.

### 5.3 ImageAnalysisService

Processes ProjectImages via a BullMQ queue (`image-analysis-queue`). Worker runs in a separate Next.js background process.

**State machine:**
```
UPLOADED → QUEUED (on enqueue) → PROCESSING (on dequeue) 
  → COMPLETED (on success)
  → RETRYING (on retryable failure, retryCount < MAX_ANALYSIS_RETRIES)
  → FAILED (on non-retryable failure OR retryCount >= MAX_ANALYSIS_RETRIES)
```

**Gemini model:** Configured via `IMAGE_ANALYSIS_MODEL` environment variable. Never hardcoded.

**Error classification:**
- Timeout → RETRYING (exponential back-off)
- Quota/Rate limit → RETRYING (back-off with jitter)
- Safety refusal → FAILED (no retry; reason stored in ImageAnalysisResult.safetyRefusalReason)
- Invalid response → RETRYING up to max, then FAILED
- Permanent failure → FAILED

**Output:** ImageAnalysisResult with all fields tagged AI_INFERRED + confidence score.

### 5.4 RecommendationEngine

See Section 7 for full algorithm. Runs synchronously within an API request for Wave 1 (given manageable catalogue size). Moves to async queue (BullMQ `recommendation-queue`) if catalogue size exceeds performance thresholds.

### 5.5 DealerDiscoveryService

Wave 1: Queries Google Places API (`nearbySearch` or `textSearch`) with Manufacturer name + coordinates. Results stored as THIRD_PARTY_DISCOVERED. No automatic VERIFIED_OFFICIAL assignment.

Wave 3: Adds a DealerVerificationService that cross-references manufacturer dealer locator APIs to attempt upgrading THIRD_PARTY_DISCOVERED records to VERIFIED_OFFICIAL.

### 5.6 EmailService

See Section 15.

### 5.7 CrossImageAggregationService (Wave 2)

Consumes per-image ImageAnalysisResults for a Project and produces a project-level synthesis. See Section 22.

### 5.8 VisualizationService (Wave 3)

See Section 13.

---

## 6. API Design

All API routes are under `/api/v1/`. Authentication is enforced via Auth.js middleware on all routes except `/api/v1/auth/*`.

### 6.1 Core Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/v1/projects | Create project |
| GET | /api/v1/projects | List active projects |
| GET | /api/v1/projects/archived | List archived projects |
| GET | /api/v1/projects/:id | Get project |
| PATCH | /api/v1/projects/:id | Update project name/description |
| POST | /api/v1/projects/:id/archive | Archive project |
| POST | /api/v1/projects/:id/unarchive | Unarchive project |
| POST | /api/v1/projects/:id/location | Set/update location |
| GET | /api/v1/projects/:id/climate | Get climate profile |
| POST | /api/v1/projects/:id/images | Upload image(s) |
| GET | /api/v1/projects/:id/images | List project images |
| DELETE | /api/v1/projects/:id/images/:imageId | Remove image (→ DELETED) |
| GET | /api/v1/projects/:id/images/:imageId/analysis | Get analysis result |
| PATCH | /api/v1/projects/:id/images/:imageId/analysis | Submit analysis corrections |
| POST | /api/v1/projects/:id/recommendations | Trigger recommendation run |
| GET | /api/v1/projects/:id/recommendations/:runId | Get recommendation results |
| GET | /api/v1/dealers | Discover dealers (query: lat, lon, brandId) |
| GET | /api/v1/brands | List manufacturers |
| GET | /api/v1/brands/:id/products | List products for manufacturer |

### 6.2 Rate-Limited Endpoints

| Endpoint | Default Limit | Config Key |
|---|---|---|
| POST /api/v1/projects/:id/images | 20 uploads/user/day | RATE_LIMIT_UPLOADS_PER_DAY |
| POST /api/v1/projects/:id/recommendations | 10 runs/user/day | RATE_LIMIT_RECOMMENDATIONS_PER_DAY |
| POST /api/v1/visualization/jobs | 5 jobs/user/day | RATE_LIMIT_VISUALIZATION_PER_DAY |
| All other API routes | 300 requests/user/minute | RATE_LIMIT_API_PER_MINUTE |

### 6.3 Error Response Format

```json
{
  "error": {
    "code": "GEOCODING_FAILED",
    "message": "Could not resolve the provided location.",
    "details": {}
  }
}
```

---

## 7. Recommendation Engine Design

### 7.1 Scoring Factors

The engine uses **exactly nine** weighted scoring factors. No other factors contribute to the composite weighted score.

| # | Factor Name | ScoringFactor Enum |
|---|---|---|
| 1 | Climate Suitability | CLIMATE_SUITABILITY |
| 2 | Interior/Exterior Compatibility | INTERIOR_EXTERIOR_COMPATIBILITY |
| 3 | Surface Compatibility | SURFACE_COMPATIBILITY |
| 4 | Product Suitability | PRODUCT_SUITABILITY |
| 5 | Architectural Characteristics | ARCHITECTURAL_CHARACTERISTICS |
| 6 | Room Type | ROOM_TYPE |
| 7 | Natural Light | NATURAL_LIGHT |
| 8 | Colour Family Compatibility | COLOUR_FAMILY_COMPATIBILITY |
| 9 | User Preferences | USER_PREFERENCES |

**PaletteHarmony is NOT a scoring factor.** It is a deterministic post-scoring selection rule applied after all scoring is complete. See Section 8.

### 7.2 Composite Score Formula

```
compositeScore = Σ (factorScore[i] × weight[i])   for i in 1..9
```

All weights are drawn from the active ScoringWeights version. Weights are normalized to sum to 1.0.

### 7.3 ScoringWeights Versioning

ScoringWeights are persisted in the `ScoringWeightVersion` relational table (Design §4.25). Each version defines weights for the exactly nine scoring factors (summing to 1.0). Each RecommendationRun holds a foreign key `scoringWeightsVersionId` referencing `ScoringWeightVersion` and preserves the snapshot `scoringWeightsVersion` tag string. One active version (`isActive = true`) is marked in the database. Administrators can create new weight versions and activate them via admin workflows (Wave 4, Task 4.3). Once a weight version is referenced by any completed RecommendationRun, it becomes immutable to preserve historical auditability. All creations and changes to active ScoringWeights are written to the AuditLog (event: SCORING_WEIGHTS_CHANGED).

### 7.4 Mandatory Compatibility Filters

Before scoring, each candidate PaintShade must pass all mandatory filters:
1. `PaintShade.provenance == VERIFIED`
2. `PaintShade.isActive == true`
3. `PaintProduct.applicationScope` is compatible with the selected ApplicationScope
4. `PaintProduct.surfaceCompatibility` intersects with the detected surfaces in ImageAnalysisResult

Candidates failing any mandatory filter are excluded from scoring entirely.

### 7.5 Engine Execution Sequence

```
1.  Load all active PaintShades for selected Manufacturer
2.  Apply mandatory compatibility filters → eligible candidate pool
3.  For each candidate in eligible pool:
      a. Compute all 9 factor scores
      b. Compute compositeScore = weighted sum
      c. Store all 9 RecommendationFactor records
4.  Sort eligible candidates: compositeScore DESC, shadeId ASC (tie-breaker)
5.  Apply Palette Harmony rule (see Section 8) → final 5 candidates
6.  Apply Filter Relaxation if fewer than 5 candidates after steps 2–5 (see Section 9)
7.  Persist Recommendation and RecommendationFactor records
8.  Persist RecommendationRun record with scoringWeightsVersion and relaxationApplied
```

---

## 8. Palette Harmony Algorithm

**Definition:** PaletteHarmony is a deterministic post-scoring rule. It prevents four or more of the five final recommendations from sharing the same colour family.

### 8.1 Algorithm Steps

```
Input: sorted candidate list (compositeScore DESC, shadeId ASC), positions 1..N

Step 1: Take positions 1–5 as the initial top-5 set T.
Step 2: Count colour family distribution in T.
Step 3: IF any single colour family appears 4 or more times in T:
    Step 4: Scan positions 6–15 (inclusive) in the sorted list.
            For each candidate C at position 6..15:
              IF C.colourFamily != the concentrated family
              AND C passes all mandatory compatibility filters:
                  → replacement_candidate = C
                  BREAK
    Step 5: IF replacement_candidate found:
              → Remove the lowest-ranked (position 5) member of T 
                that belongs to the concentrated family
              → Insert replacement_candidate at the correct score-descending position in T
              → Set Recommendation.isHarmonyReplacement = true for replacement_candidate
              → Set Recommendation.replacedCandidateId = id of the removed candidate
              → Re-rank T positions 1–5 in compositeScore DESC order (shadeId ASC tie-breaker)
    Step 6: IF no replacement_candidate found in positions 6–15:
              → Leave T unchanged (Palette Harmony not applicable)
              → Log a warning in the RecommendationRun record
Step 7: Return final T (5 recommendations, deterministically ordered)
```

**Concentration threshold:** 4 or more of 5 candidates sharing one colour family.
**Replacement search range:** Positions 6–15 inclusive in the sorted candidate list.
**Replacement target:** The lowest-ranked (rank 5) candidate belonging to the concentrated colour family.
**Mandatory filters:** The replacement candidate must pass all mandatory compatibility filters.
**Determinism:** Tie-breaking is always shadeId ASC. The algorithm produces the same output given the same inputs.

### 8.2 RecommendationRun Persistence

`RecommendationRun.paletteHarmonyApplied` is set to `true` when a replacement was made.
`Recommendation.isHarmonyReplacement` is set to `true` on the inserted replacement.
`Recommendation.replacedCandidateId` records which candidate was removed.

---

## 9. Filter Relaxation Sequence

When fewer than five candidates remain after mandatory filtering AND after the Palette Harmony check, the engine applies relaxations in this **exact deterministic order**:

| Step | Relaxation | Description |
|---|---|---|
| 1 | Relax COLOUR_FAMILY_COMPATIBILITY | Remove colour family compatibility constraint |
| 2 | Relax NATURAL_LIGHT | Remove natural light compatibility constraint |
| 3 | Relax ROOM_TYPE | Remove room type compatibility constraint |
| 4 | Relax ARCHITECTURAL_CHARACTERISTICS | Remove architectural characteristics constraint |

**Rules:**
- Apply one relaxation step at a time, re-evaluate candidate count after each step.
- Stop as soon as five or more candidates are available.
- The engine does NOT dynamically decide which constraint to relax first — the order is fixed as defined above.
- The engine does NOT invent or interpolate shades. All candidates must still be VERIFIED PaintShades.
- `RecommendationRun.relaxationApplied` records the ordered list of relaxation steps that were applied (empty array if none needed).

**Fewer-than-five result:**
If fewer than five VERIFIED candidates remain after all four relaxation steps, the engine returns all available valid candidates. The API response includes:
```json
{
  "relaxationStepsApplied": ["COLOUR_FAMILY_COMPATIBILITY", "NATURAL_LIGHT"],
  "recommendationCount": 3,
  "insufficientCandidatesReason": "Fewer than 5 verified shades match surface and scope requirements after full relaxation."
}
```
The UI displays this explanation prominently to the User.

---

## 10. Image Analysis Pipeline

### 10.1 Queue Architecture

```
Upload API Handler
  → sets ProjectImage.processingState = QUEUED
  → pushes job { projectImageId } to BullMQ image-analysis-queue

BullMQ Worker (analysis-worker.ts)
  → dequeues job
  → sets processingState = PROCESSING
  → calls GeminiAnalysisClient.analyzeImage(storageKey)
  → on success: creates ImageAnalysisResult, sets processingState = COMPLETED
  → on retryable error: increments retryCount, sets processingState = RETRYING
  → on terminal error: sets processingState = FAILED, records error
```

### 10.2 Gemini API Integration — Image Analysis

**Model:** `process.env.IMAGE_ANALYSIS_MODEL` (required, no default)

**Prompt structure:** Structured JSON-extraction prompt requesting: spaceType, isInterior, facadeType, floorCount, architecturalStyle, visibleSurfaces (array), naturalLightQuality, naturalLightDirection, paintableRegions (array of descriptors), with confidence scores per field.

**Timeout:** Configurable via `IMAGE_ANALYSIS_TIMEOUT_MS` (default: 25000 ms)

**Retry policy:**
```
Error Type         | Action
Timeout            | RETRYING, back-off: 2s, 4s, 8s (max 3 retries)
Quota / Rate Limit | RETRYING, back-off with jitter: up to 60s
Safety Refusal     | FAILED immediately; no retry
Invalid Response   | RETRYING (up to max), then FAILED
HTTP 5xx           | RETRYING (up to max), then FAILED
```

**Audit logging:** All errors logged to AuditLog. Image binary data and PII never logged.

---

## 11. Climate Service Design

### 11.1 Open-Meteo Client

- Endpoint: `https://archive-api.open-meteo.com/v1/archive` (historical averages) and `https://api.open-meteo.com/v1/forecast`
- Parameters: latitude, longitude, monthly aggregates for temperature, precipitation, humidity, UV index, wind speed/direction
- No API key required (public API). Rate-limited per IP; retries respect Retry-After headers.

### 11.2 Regional Aggregate Dataset

A bundled JSON dataset keyed by approximate climate zone (derived from lat/lon bounding boxes). Provides approximate monthly averages when the Open-Meteo API is unavailable.

- Provenance: DERIVED
- DataSource.name: `"REGIONAL_AGGREGATE_CLIMATE_v1"`
- User-facing note: "Regional average climate data was used. Local conditions may vary."

### 11.3 ClimateService Retry Logic

```
Attempt 1: Open-Meteo API
Attempt 2: Open-Meteo API (after 2s delay)
Attempt 3: Open-Meteo API (after 4s delay)
→ All failed: RegionalAggregateClient (no retry; always succeeds)
→ If RegionalAggregateClient has no data for coordinates: throw ClimateUnavailableException
```

---

## 12. Geocoding Service Design

### 12.1 Provider Registry

```typescript
interface GeocodingProvider {
  name: string;
  isActive: boolean;
  priority: number; // lower = higher priority
  resolve(input: string): Promise<GeocodingResult>;
}

class GoogleGeocodingClient implements GeocodingProvider {
  // Uses GOOGLE_GEOCODING_API_KEY env var
  // Endpoint: https://maps.googleapis.com/maps/api/geocode/json
}

class MapplsGeocodingClient implements GeocodingProvider {
  // Uses MAPPLS_API_KEY env var
  // Explicitly deferred in Wave 1: isActive = false
}
```

### 12.2 Provider Selection

In Wave 1, GeocodingService selects the single active provider (GoogleGeocodingClient). When a second provider is active, selection is by priority ascending, with failover on retryable errors.

### 12.3 Dealer Discovery vs. Geocoding

**GeocodingService** (this section): Converts address/PIN to lat/lon. Used during project location setup.

**DealerDiscoveryService** (Section 14): Uses already-resolved lat/lon to query Google Places API for nearby paint dealers. These are two distinct services with distinct API keys and distinct responsibilities.

---

## 13. Visualization Pipeline (Wave 3)

> Visualization is scoped exclusively to Wave 3. Wave 1 E2E tests MUST NOT depend on any visualization endpoint or component.

### 13.1 Source Image Selection

- User explicitly clicks "Visualize this image" on a specific ProjectImage
- The UI POSTs `{ sourceImageId: projectImageId, recommendationRunId }` to `POST /api/v1/visualization/jobs`
- The API validates that the ProjectImage belongs to the authenticated User's Project
- The selected ProjectImage ID is stored as `ImageGenerationJob.projectImageId` (sourceImageId)
- The Platform NEVER silently defaults to the first or a random ProjectImage

### 13.2 Gemini Image Generation

**Model:** `process.env.GEMINI_IMAGE_MODEL` (required, separate from IMAGE_ANALYSIS_MODEL)

**Job flow:**
```
POST /api/v1/visualization/jobs
  → creates ImageGenerationJob (status=QUEUED)
  → pushes to BullMQ visualization-queue

visualization-worker.ts
  → dequeues job (status=PROCESSING)
  → fetches sourceImage from Blob Storage
  → constructs Gemini prompt with shade colours and surface regions
  → calls Gemini API (model=GEMINI_IMAGE_MODEL)
  → on success: stores GeneratedImage in Blob Storage, status=COMPLETED
  → on retryable failure: status=RETRYING, exponential back-off
  → on safety refusal: loads GeminiFallbackPrompt, retries once with fallback
  → on permanent failure: status=FAILED, notify User, write AuditLog
```

### 13.3 Gemini Model Error Handling

| Error | Action |
|---|---|
| Timeout | RETRYING, exponential back-off |
| Rate limit / Quota | RETRYING, back-off + jitter |
| Safety refusal (primary prompt) | Load GeminiFallbackPrompt, retry once |
| Safety refusal (fallback prompt) | FAILED |
| Invalid response | RETRYING up to max, then FAILED |
| Permanent failure | FAILED, AuditLog entry, User notification |

### 13.4 Indicative Previews

Where the visualization pipeline produces an indicative/watermarked preview (e.g., low-resolution or partial), the GeneratedImage is stored with `isIndicative = true`. The UI labels it clearly as "Indicative Preview" and does not present it as a final result.

---

## 14. Dealer Discovery and Verification

### 14.1 Discovery (Wave 1)

- Provider: Google Places API (`nearbySearch`, radius = configurable, default 10 km)
- Input: confirmed project lat/lon + selected Manufacturer name
- Output: Dealer records with `DealerState = THIRD_PARTY_DISCOVERED`
- Stored fields: name, address, lat/lon, phone, discoverySource = "GOOGLE_PLACES"

### 14.2 Verification (Wave 3)

- DealerVerificationService calls official manufacturer dealer/store locator APIs (per Manufacturer)
- A THIRD_PARTY_DISCOVERED dealer is upgraded to VERIFIED_OFFICIAL only after a successful authoritative match
- A DealerVerificationRecord is created for every verification attempt (pass or fail)
- Google Places / Mappls results alone NEVER constitute verification

### 14.3 Dealer States

| State | Meaning |
|---|---|
| VERIFIED_OFFICIAL | Confirmed via official manufacturer dealer locator |
| THIRD_PARTY_DISCOVERED | Found via Google Places / Mappls, not yet verified |
| UNVERIFIED | Added manually or from an unverified source |

---

## 15. Email Service Design

### 15.1 Abstraction

```typescript
interface EmailService {
  send(notification: EmailNotification): Promise<void>;
}

interface EmailProvider {
  deliver(message: EmailMessage): Promise<EmailDeliveryResult>;
}

class SendGridEmailProvider implements EmailProvider { ... }
class AzureCommunicationEmailProvider implements EmailProvider { ... }
```

### 15.2 Notification Types

| Type | Trigger |
|---|---|
| EMAIL_VERIFICATION | New user registration (coordinated with Entra External ID) |
| PASSWORD_RESET | Entra External ID delegates email delivery |
| PRIVACY_NOTIFICATION | Privacy policy version change |
| DSAR_CONFIRMATION | DSAR submitted |
| ACCOUNT_DELETION_CONFIRMATION | Account deletion initiated |

### 15.3 Configuration

- Provider selection: `EMAIL_PROVIDER` env var (`"sendgrid"` | `"azure_communication"`)
- API key / credentials: `SENDGRID_API_KEY` or `AZURE_EMAIL_CONNECTION_STRING` — from env vars or Azure Key Vault only
- Sender address: `EMAIL_FROM_ADDRESS` env var
- Templates: stored as files in `/src/email-templates/` with Handlebars syntax
- Retry: up to `EMAIL_RETRY_COUNT` (default: 3) with exponential back-off
- Delivery status logged (email address, notification type, status, timestamp) — NOT the message body

### 15.4 Safe Logging

- EmailService logs: notification type, recipient email hash (SHA-256), delivery outcome, timestamp
- EmailService does NOT log: message body, subject line, API credentials, or plaintext recipient address in log files

---

## 16. Security Design

### 16.1 Secrets Management

| Secret | Storage |
|---|---|
| GOOGLE_GEOCODING_API_KEY | Azure Key Vault / env var |
| MAPPLS_API_KEY | Azure Key Vault / env var |
| GEMINI_API_KEY | Azure Key Vault / env var |
| DATABASE_URL | Azure Key Vault / env var |
| REDIS_URL | Azure Key Vault / env var |
| AZURE_STORAGE_CONNECTION_STRING | Azure Key Vault / env var |
| EMAIL provider credentials | Azure Key Vault / env var |
| ENTRA_CLIENT_ID / ENTRA_CLIENT_SECRET | Azure Key Vault / env var |
| NEXTAUTH_SECRET | Azure Key Vault / env var |

SystemConfig database records MUST NOT store any of the above values.

### 16.2 OWASP Mitigations

- SQL injection: Prisma parameterized queries (no raw string interpolation)
- XSS: React's default escaping; CSP headers via Next.js middleware
- CSRF: SameSite=Lax cookies + CSRF token on state-changing routes
- IDOR: All resource queries scoped to `userId` from session
- Rate limiting: Centralized, Redis-backed (Section 17)
- HTTPS: Enforced via Azure App Service configuration and HSTS header
- Input validation: Zod schemas on all API input payloads

### 16.3 Image Upload Security

- File type validated by MIME type + magic bytes (not only extension)
- File size enforced server-side before streaming to Blob Storage
- Images stored in a private Blob Storage container; served via signed URLs with TTL
- Images transmitted to Gemini API over HTTPS only

---

## 17. Rate Limiting Design

### 17.1 Architecture

Rate limiting is implemented as Next.js API middleware using Redis sliding-window counters (via `ioredis`). All thresholds are loaded from a single centralized configuration object:

```typescript
// src/config/rate-limits.ts
export const RATE_LIMITS = {
  API_PER_MINUTE: parseInt(process.env.RATE_LIMIT_API_PER_MINUTE ?? '300'),
  UPLOADS_PER_DAY: parseInt(process.env.RATE_LIMIT_UPLOADS_PER_DAY ?? '20'),
  RECOMMENDATIONS_PER_DAY: parseInt(process.env.RATE_LIMIT_RECOMMENDATIONS_PER_DAY ?? '10'),
  VISUALIZATION_PER_DAY: parseInt(process.env.RATE_LIMIT_VISUALIZATION_PER_DAY ?? '5'),
};
```

Individual service implementations do NOT hardcode limits. They read from `RATE_LIMITS`.

### 17.2 Response on Limit Exceeded

```
HTTP 429 Too Many Requests
Headers:
  Retry-After: <seconds until reset>
  X-RateLimit-Limit: <limit>
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset: <unix timestamp>
Body: { "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "..." } }
```

AuditLog entry written: event=RATE_LIMIT_EXCEEDED, userId, endpoint, timestamp.

---

## 18. Configuration and Secrets Management

### 18.1 Environment Variables

All runtime configuration is supplied via environment variables. A `.env.example` file documents all required and optional variables. In production, variables are sourced from Azure Key Vault via Azure App Service's Key Vault References feature.

### 18.2 SystemConfig

The SystemConfig table (if used) stores only non-secret runtime configuration values such as:
- Feature flags (e.g., `FEATURE_MAPPLS_GEOCODING_ENABLED`)
- UI display strings (e.g., `PRIVACY_POLICY_VERSION`)
- Catalogue metadata

SystemConfig MUST NOT store API keys, OAuth secrets, database passwords, or connection strings.

---

## 19. Observability and Logging

### 19.1 Structured Logging

All application logs use JSON format with fields: `timestamp`, `level`, `service`, `traceId`, `userId` (anonymized), `message`, `metadata`.

### 19.2 Azure Application Insights

- Distributed tracing across API routes and background workers
- Custom metrics: recommendation_run_duration_ms, image_analysis_duration_ms, geocoding_duration_ms
- Alerts: error rate > 1%, queue depth > 100, p95 response > 2s

### 19.3 Log Retention

- Application logs: 30 days hot, 90 days cold
- AuditLog: 7 years (compliance retention, append-only)
- Image analysis error logs: 90 days

---

## 20. Wave Architecture Summary

### Wave 0 — Foundation
Next.js scaffolding, Azure SQL + Prisma setup, Azure Blob Storage, Azure Redis, Entra External ID + Auth.js integration, EmailService abstraction, Azure Key Vault integration, BullMQ workers, CI/CD pipeline (GitHub Actions → Azure), Application Insights, structured logging, centralized rate limiting, base Prisma migrations for all tables.

### Wave 1 — MVP (E2E Vertical Slice)
Registration → Login → Create Project → Enter Location → Geocoding (Google) → Climate Profile → Upload Images → Image Analysis (Gemini) → Analysis Review & Correction UI → Manufacturer/Scope Selection → Recommendation Run → Recommendation Display + Explanation → Basic Dealer Discovery.

**MVP Manufacturer Catalogue:** At minimum one Manufacturer (e.g., Asian Paints) with a populated VERIFIED PaintShade catalogue. Other Manufacturers are surfaced in the UI with a "Coming Soon" state and are clearly not available for recommendation runs.

**Wave 1 E2E tests do NOT test:** visualization, SAM2 segmentation, multi-image aggregation, advanced dealer verification, DSAR flows, account deletion.

### Wave 2 — Recommendation Depth
Remaining Manufacturer catalogues, user preferences input UI, Colour Family Compatibility factor implementation, multi-image analysis aggregation (CrossImageAggregationService), BOTH scope recommendation logic, advanced SAM2 segmentation (optional, architecturally separable), full Palette Harmony implementation with replacement.

### Wave 3 — Visualization
Source image selection UI, `POST /api/v1/visualization/jobs`, ImageGenerationJob queue, visualization-worker.ts, Gemini image generation (GEMINI_IMAGE_MODEL), GeneratedImage storage, retry/fallback handling, GeminiFallbackPrompt management, indicative preview labeling, visualization results UI, advanced dealer verification (DealerVerificationService).

### Wave 4 — Operations/Compliance
DSAR submission and export, account deletion, PaintShade catalogue administration UI, ScoringWeights administration UI, AuditLog viewer, reporting dashboard, PDF recommendation export, security regression suite.

### Wave 5 — Production Hardening
Performance optimization (database indexing, query optimization, CDN), accessibility audit (WCAG 2.1 AA), security hardening (penetration test remediation), backup/restore procedures, production monitoring runbooks, load testing to production targets, final production acceptance.

---

## 21. Performance Targets

### 21.1 MVP / Baseline Targets (Wave 1, up to 50 concurrent users)

| Metric | Target |
|---|---|
| LCP (primary pages) | < 2.5 s |
| API response p95 (non-analysis, non-recommendation) | < 500 ms |
| Recommendation generation p95 | < 10 s |
| Image analysis p95 (single image, Gemini round-trip) | < 30 s |
| Image upload confirmation (to Blob Storage) p95 | < 5 s |
| Geocoding resolution p95 | < 2 s |
| Queue processing throughput | ≥ 10 analysis jobs/minute |

### 21.2 Production Targets (Wave 5, up to 500 concurrent users)

Detailed production targets are defined during Wave 5 based on load-test results. Baseline: sustain MVP targets with ≤ 20% degradation under 10× user load.

| Metric | Indicative Production Target |
|---|---|
| LCP | < 2.5 s |
| API response p95 | < 800 ms |
| Recommendation generation p95 | < 15 s |
| Image analysis p95 | < 45 s |
| Visualization generation p95 (Wave 3) | < 60 s |
| Queue processing throughput | ≥ 50 analysis jobs/minute |

---

## 22. Multi-Image Aggregation (Wave 2)

### 22.1 CrossImageAggregationService

**Input:** All ImageAnalysisResults for a Project in COMPLETED state.
**Output:** A project-level synthesis record stored in the dedicated `ProjectAnalysisSynthesis` model (Design §4.24) linked to `Project` via `projectId`, preserving the strict 1:1 relation between `ProjectImage` and `ImageAnalysisResult`.

**Conflict resolution:**
- Majority vote for categorical fields (spaceType, architecturalStyle, isInterior)
- Union for set-valued fields (visibleSurfaces, paintableRegions)
- Maximum confidence weighting when majority vote is tied
- All conflict resolutions recorded in synthesis metadata
- Recorded in `ProjectAnalysisSynthesis.aggregationMetadata`

**Provenance:** Fields derived from majority vote tagged as DERIVED. Fields from a single unanimous source tagged with their original AnalysisState. Overall record provenance defaults to DERIVED.

### 22.2 SAM2 Integration (Optional)

SAM2 (Segment Anything Model 2) provides improved paintable-region segmentation. It is deployed as a separate inference service and called by ImageAnalysisService when available. The analysis pipeline functions correctly without SAM2 (graceful degradation). SAM2 integration is architecturally separable and does not block Wave 2 delivery.

---

## 23. Project Archiving Design

### 23.1 State Machine

```
ACTIVE ←→ ARCHIVED
```

- Archiving: `POST /api/v1/projects/:id/archive` → sets `archivedAt = now()`, `status = ARCHIVED`
- Unarchiving: `POST /api/v1/projects/:id/unarchive` → sets `archivedAt = null`, `status = ACTIVE`
- No data is deleted on archiving
- Archived projects do not appear in the default project list
- A dedicated `/api/v1/projects/archived` endpoint returns archived projects for the authenticated user

### 23.2 Archive Behavior

- All associated ProjectImages, ImageAnalysisResults, ClimateProfiles, and Recommendations are retained
- Archived projects cannot generate new RecommendationRuns until unarchived
- Image uploads to ARCHIVED projects are rejected with HTTP 409 Conflict

---

## 24. Privacy and Consent Design

### 24.1 Privacy Policy Acceptance

- Presented as a mandatory checkbox during registration
- Stored: `UserProfile.privacyPolicyVersion` (e.g., "v1.2"), `UserProfile.privacyAcceptedAt`
- A separate AI disclosure checkbox ("I understand that uploaded photos may be processed by Google Gemini AI") is also required
- Stored: `UserProfile.aiDisclosureAcceptedAt`
- Both are required before account creation completes

### 24.2 Terms of Service

If a separate Terms of Service document is introduced, a `tosVersion` and `tosAcceptedAt` field will be added to UserProfiles. This is architecturally reserved but not required in Wave 0.

### 24.3 DSAR and Account Deletion (Wave 4)

DSAR: `POST /api/v1/users/me/dsar` → creates a DSAR record, writes AuditLog entry, sends DSAR_CONFIRMATION email, and queues a data export compilation job.

Account Deletion: `DELETE /api/v1/users/me` → marks account for deletion, writes AuditLog, sends confirmation email, queues a deletion job that anonymizes all personal data within the configured retention period.

---
