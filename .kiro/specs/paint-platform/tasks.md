# Implementation Tasks

## Climate-Aware Home Paint Recommendation & Visualization Platform

---

## Overview

Tasks are organized into six delivery waves. Each task references the requirement(s) it implements and the design section that describes the approach. The traceability matrix at the end of this document maps every functional requirement to its implementation and test tasks.

**Wave Structure:**
- Wave 0 — Foundation
- Wave 1 — MVP (E2E Vertical Slice)
- Wave 2 — Recommendation Depth
- Wave 3 — Visualization
- Wave 4 — Operations/Compliance
- Wave 5 — Production Hardening

---

## Wave 0 — Foundation

### 0.1 Repository and CI/CD Setup

- [ ] 0.1.1 Initialize Next.js 14 (App Router) TypeScript project with ESLint, Prettier, and Husky pre-commit hooks
- [ ] 0.1.2 Configure GitHub Actions CI pipeline: lint, type-check, unit test, build
- [ ] 0.1.3 Configure GitHub Actions CD pipeline: deploy to Azure App Service (staging slot)
- [ ] 0.1.4 Create `.env.example` documenting all required environment variables with descriptions and no secret values
- [ ] 0.1.5 Configure Azure Key Vault and App Service Key Vault References for all secrets listed in Design §16.1, §18.1

### 0.2 Database Setup

- [ ] 0.2.1 Provision Azure SQL Database (SQL Server) and store connection string in Key Vault
- [ ] 0.2.2 Initialize Prisma 5 with SQL Server provider; configure `DATABASE_URL` via env var
- [ ] 0.2.3 Create Prisma migration: `Users` table (Design §4.1)
- [ ] 0.2.4 Create Prisma migration: `UserProfiles` table (Design §4.2)
- [ ] 0.2.5 Create Prisma migration: `Projects` table (Design §4.3)
- [ ] 0.2.6 Create Prisma migration: `ProjectLocations` table (Design §4.4)
- [ ] 0.2.7 Create Prisma migration: `ProjectImages` table with `ImageProcessingState` enum (Design §4.5)
- [ ] 0.2.8 Create Prisma migration: `ImageAnalysisResults` table with `AnalysisState` enum (Design §4.6)
- [ ] 0.2.9 Create Prisma migration: `PaintBrands` table (Design §4.7)
- [ ] 0.2.10 Create Prisma migration: `PaintProducts` table with `ApplicationScope` enum (Design §4.8)
- [ ] 0.2.11 Create Prisma migration: `PaintShades` table with `Provenance` enum (Design §4.9)
- [ ] 0.2.12 Create Prisma migration: `PaintShadeSources` table (Design §4.10)
- [ ] 0.2.13 Create Prisma migration: `ClimateProfiles` table (Design §4.11)
- [ ] 0.2.14 Create Prisma migration: `ClimateObservations` table (Design §4.12)
- [ ] 0.2.15 Create Prisma migration: `RecommendationRuns` table with `RunStatus` enum (Design §4.13)
- [ ] 0.2.16 Create Prisma migration: `Recommendations` table (Design §4.14)
- [ ] 0.2.17 Create Prisma migration: `RecommendationFactors` table with `ScoringFactor` enum (Design §4.15)
- [ ] 0.2.18 Create Prisma migration: `Dealers` table with `DealerState` enum (Design §4.16)
- [ ] 0.2.19 Create Prisma migration: `DealerBrands` table with foreign key relations to `Dealer` and `PaintBrand` (Design §4.7, §4.17)
- [ ] 0.2.20 Create Prisma migration: `DealerVerificationRecords` table (Design §4.18)
- [ ] 0.2.21 Create Prisma migration: `ImageGenerationJobs` table with `GenerationJobStatus` enum (Design §4.19)
- [ ] 0.2.22 Create Prisma migration: `GeneratedImages` table (Design §4.20)
- [ ] 0.2.23 Create Prisma migration: `GeminiFallbackPrompts` table (Design §4.21)
- [ ] 0.2.24 Create Prisma migration: `DataSources` table (Design §4.22)
- [ ] 0.2.25 Create Prisma migration: `AuditLogs` table (Design §4.23)
- [ ] 0.2.26 Create Prisma migration: `ProjectAnalysisSynthesis` table (Design §4.24)
- [ ] 0.2.27 Create Prisma migration: `ScoringWeightVersion` table (Design §4.25)
- [ ] 0.2.28 Verify all 25 Prisma models compile without errors; run `prisma migrate deploy` on staging DB
- [ ] 0.2.29 Write database seed script for: 4 PaintBrand records (Asian Paints, Birla Opus, Nerolac, Berger Paints), DataSource seed records for climate and geocoding providers, and initial active ScoringWeightVersion (v1.0.0 with 9 normalized weights)

### 0.3 Object Storage Setup

- [ ] 0.3.1 Provision Azure Blob Storage account; create private containers: `project-images`, `generated-images`
- [ ] 0.3.2 Configure connection string in Key Vault; implement `BlobStorageService` with `upload`, `getSignedUrl`, `delete` methods
- [ ] 0.3.3 Write unit tests for `BlobStorageService` (upload, signed URL TTL, delete)

### 0.4 Redis and Queue Setup

- [ ] 0.4.1 Provision Azure Cache for Redis; store connection string in Key Vault
- [ ] 0.4.2 Configure BullMQ with `image-analysis-queue` and `recommendation-queue`; create worker process entrypoint (`analysis-worker.ts`)
- [ ] 0.4.3 Implement centralized rate-limit middleware (`src/middleware/rate-limit.ts`) reading from `src/config/rate-limits.ts` (Design §17.1)
- [ ] 0.4.4 Write unit tests for rate-limit middleware: verify 429 + Retry-After response; verify AuditLog entry on limit exceeded

### 0.5 Authentication Setup

- [ ] 0.5.1 Create Microsoft Entra External ID tenant (or configure existing); register app with redirect URIs for staging and production; configure tenant lockout / CAPTCHA challenge policy after configurable failed attempts (Req 1.7) and enable social identity provider pass-through (Req 1.9)
- [ ] 0.5.2 Configure Auth.js v5 with Entra External ID as OIDC provider; store `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `NEXTAUTH_SECRET` in Key Vault
- [ ] 0.5.3 Implement Auth.js session middleware protecting all `/api/v1/*` routes
- [ ] 0.5.4 Implement post-login callback handler: create/update `User` record (internalUserId, externalSubjectId, email, role=USER); write AuditLog entry for authentication events (REGISTRATION, LOGIN, EMAIL_VERIFIED, ROLE_CHANGED per Req 1.8; Design §3.4)
- [ ] 0.5.5 Verify that no password hash, TOTP secret, or plaintext password is stored in the `Users` table — add a database schema check in CI
- [ ] 0.5.6 Implement AUTH_PROVIDER=EntraExternalID invariant test: assert no `/api/auth/register` or `/api/auth/login` endpoint exists with independent credential handling
- [ ] 0.5.7 Write integration tests for authentication: registration callback creates User record, login writes AuditLog, failed login writes LOGIN_FAILED AuditLog, protected route returns 401 without session

### 0.6 Email Service Setup

- [ ] 0.6.1 Implement `EmailService` interface and `EmailProvider` abstraction (Design §15.1)
- [ ] 0.6.2 Implement `SendGridEmailProvider` using `SENDGRID_API_KEY` env var
- [ ] 0.6.3 Implement `AzureCommunicationEmailProvider` using `AZURE_EMAIL_CONNECTION_STRING` env var
- [ ] 0.6.4 Implement provider selection via `EMAIL_PROVIDER` env var
- [ ] 0.6.5 Create email templates (Handlebars) for: EMAIL_VERIFICATION, PASSWORD_RESET, PRIVACY_NOTIFICATION, DSAR_CONFIRMATION, ACCOUNT_DELETION_CONFIRMATION
- [ ] 0.6.6 Implement retry logic: up to `EMAIL_RETRY_COUNT` attempts with exponential back-off
- [ ] 0.6.7 Write unit tests: verify no plaintext credentials in logs; verify retry behavior; verify template rendering

### 0.7 Observability Setup

- [ ] 0.7.1 Configure Azure Application Insights SDK in Next.js app and worker process
- [ ] 0.7.2 Implement structured JSON logging (`src/lib/logger.ts`) with fields: timestamp, level, service, traceId, userId (anonymized)
- [ ] 0.7.3 Configure Application Insights alerts: error rate > 1%, p95 response > 2s, queue depth > 100
- [ ] 0.7.4 Write a smoke test asserting structured log output format on application start

---

## Wave 1 — MVP

### 1.1 User Registration, Login, and Privacy Consent

- [ ] 1.1.1 Implement registration UI: "Create Account" button → redirect to Entra External ID sign-up (Req 1.1)
- [ ] 1.1.2 Implement registration callback: coordinate email verification with Entra External ID; display Privacy Policy and AI disclosure checkboxes; require both before completing registration; write EMAIL_VERIFIED AuditLog entry (Req 1.4, 1.5, 1.8, 14.1)
- [ ] 1.1.3 Implement `POST /api/v1/auth/consent` endpoint: persist `UserProfile` with `privacyPolicyVersion`, `privacyAcceptedAt`, `aiDisclosureAcceptedAt` (Req 1.4, 1.5)
- [ ] 1.1.4 Implement login UI: "Sign In" button → redirect to Entra External ID; on callback, establish Auth.js session (Req 1.6)
- [ ] 1.1.5 Implement logout: `POST /api/v1/auth/logout` → destroy Auth.js session, write LOGOUT AuditLog entry (Req 1.8)
- [ ] 1.1.6 Implement "Forgot Password" link: redirect to Entra External ID password reset flow; write PASSWORD_RESET_INITIATED AuditLog entry on callback (Req 1.10)
- [ ] 1.1.7 Write integration tests: registration flow creates UserProfile with consent fields; login without consent record is rejected; logout writes AuditLog

### 1.2 Project Management

- [ ] 1.2.1 Implement `POST /api/v1/projects`: create Project (name, optional description), owner=authenticated user, status=ACTIVE (Req 2.1, 2.2)
- [ ] 1.2.2 Implement `GET /api/v1/projects`: return only ACTIVE projects for authenticated user (Req 2.3)
- [ ] 1.2.3 Implement `GET /api/v1/projects/archived`: return ARCHIVED projects for authenticated user (Req 2.4)
- [ ] 1.2.4 Implement `POST /api/v1/projects/:id/archive`: set `archivedAt=now()`, `status=ARCHIVED` (Req 2.5; Design §23)
- [ ] 1.2.5 Implement `POST /api/v1/projects/:id/unarchive`: clear `archivedAt`, `status=ACTIVE` (Req 2.6; Design §23)
- [ ] 1.2.6 Implement `PATCH /api/v1/projects/:id`: update name and/or description for ACTIVE projects; reject updates to ARCHIVED projects with 409 (Req 2.8; Design §23.2)
- [ ] 1.2.7 Implement authorization guard: `GET /PATCH /DELETE /api/v1/projects/:id` returns 403 + AuditLog if user does not own the project (Req 2.7)
- [ ] 1.2.8 Implement project list UI: shows active projects, archive button, link to archived view
- [ ] 1.2.9 Write integration tests: create project, archive/unarchive cycle, unauthorized access returns 403 + AuditLog entry, archived project upload rejected with 409

### 1.3 Location Input and Geocoding

- [ ] 1.3.1 Implement `GoogleGeocodingClient`: calls Google Geocoding API using `GOOGLE_GEOCODING_API_KEY`; returns lat/lon + resolved address (Req 3.2, 3.3; Design §12)
- [ ] 1.3.2 Implement `GeocodingService`: invokes active providers by priority; handles fallback; records provenance (Req 3.2–3.6; Design §12)
- [ ] 1.3.3 Stub `MapplsGeocodingClient` as inactive (`isActive=false`) for Wave 1; document deferred status in code comments (Req 3.8; Design §12.1)
- [ ] 1.3.4 Implement `POST /api/v1/projects/:id/location`: accept raw input, call GeocodingService, return resolved address + coordinates for confirmation; do NOT persist until confirmed (Req 3.1, 3.7)
- [ ] 1.3.5 Implement `POST /api/v1/projects/:id/location/confirm`: persist ProjectLocation with provenance tags; trigger climate retrieval (Req 3.6, 3.7)
- [ ] 1.3.6 Implement location input UI: text field, submit, display confirmation map with resolved address, confirm/re-enter options
- [ ] 1.3.7 Write unit tests for `GeocodingService`: successful resolution, primary failure triggers error (no secondary in Wave 1), input too ambiguous returns descriptive error
- [ ] 1.3.8 Write integration tests for location endpoint: valid PIN resolves correctly, unresolvable address returns 422 with error message, location stored with correct provenance

### 1.4 Climate Profile Retrieval

- [ ] 1.4.1 Implement `OpenMeteoClient`: fetch monthly climate aggregates (temperature, humidity, rainfall, UV, wind) for lat/lon (Req 4.1; Design §11.1)
- [ ] 1.4.2 Implement `RegionalAggregateClient`: load bundled regional climate dataset; return aggregate data for lat/lon bounding box (Req 4.3; Design §11.2)
- [ ] 1.4.3 Implement `ClimateService`: retry primary source up to `CLIMATE_RETRY_COUNT`; fall back to RegionalAggregateClient on exhaustion; set provenance VERIFIED or DERIVED; persist ClimateProfile + ClimateObservations + DataSource record; halt and disallow recommendations if no climate data available (Req 4.2–4.7; Design §11.3)
- [ ] 1.4.4 Implement `GET /api/v1/projects/:id/climate`: return ClimateProfile; include `climateDataNote` in response when provenance=DERIVED (Req 4.4, 4.5)
- [ ] 1.4.5 Implement climate display UI: show monthly data, annual summary; display DERIVED notice prominently when applicable
- [ ] 1.4.6 Write unit tests for `ClimateService`: VERIFIED path sets correct provenance; fallback path sets DERIVED; exhausted primary + no regional data throws ClimateUnavailableException and prevents recommendation generation (Req 4.7)
- [ ] 1.4.7 Write property test: for any valid lat/lon pair within supported bounds, `ClimateService.retrieve()` returns a ClimateProfile with 12 ClimateObservation records and provenance in {VERIFIED, DERIVED}

### 1.5 Image Upload

- [ ] 1.5.1 Implement `POST /api/v1/projects/:id/images`: accept multipart upload (1 to max files); validate MIME type + magic bytes; validate file size ≤ `MAX_IMAGE_SIZE_BYTES`; reject uploads to ARCHIVED projects with 409; store to Blob Storage; create ProjectImage with state=UPLOADED; enqueue to `image-analysis-queue` (state→QUEUED) (Req 5.1–5.5; Design §4.5, §10.1, §16.3, §23.2)
- [ ] 1.5.2 Implement upload rate limiting: enforce `RATE_LIMIT_UPLOADS_PER_DAY` per user via centralized rate-limit middleware; return 429 + Retry-After on limit exceeded (Req 5.4, 15.1)
- [ ] 1.5.3 Implement `DELETE /api/v1/projects/:id/images/:imageId`: transition ProjectImage state to DELETED; exclude from analysis and recommendation runs (Req 5.6)
- [ ] 1.5.4 Implement upload UI: multi-file selector, real-time progress per file, remove button, status indicator (Req 5.7)
- [ ] 1.5.5 Write unit tests: file type rejection (invalid MIME, wrong magic bytes), file size rejection, upload rate limit returns 429, DELETED image excluded from analysis queue
- [ ] 1.5.6 Write property test: for any uploaded image with valid MIME and size ≤ max, `POST /images` returns 201 and creates a ProjectImage with state UPLOADED or QUEUED
- [ ] 1.5.7 Verify uploaded images are transmitted to Gemini API over HTTPS only and implement image data retention lifecycle policy (Req 13.5; Design §16.3, §19.3, §24.3)

### 1.6 AI Image Analysis

- [ ] 1.6.1 Implement `GeminiAnalysisClient` using `IMAGE_ANALYSIS_MODEL` env var; implement structured JSON-extraction prompt; parse response into ImageAnalysisResult fields with confidence scores (Req 6.3, 6.4; Design §10.2)
- [ ] 1.6.2 Implement `analysis-worker.ts` (BullMQ worker): dequeue job, transition state QUEUED→PROCESSING, call GeminiAnalysisClient, handle success/retry/failure states per Design §10.1 state machine; process multiple images independently in Wave 1 (Req 6.1–6.10; Design §10.1)
- [ ] 1.6.3 Implement Gemini error classification: timeout→RETRYING (exponential back-off), quota→RETRYING (back-off+jitter), safety refusal→FAILED (no retry, record reason), invalid response→RETRYING→FAILED, HTTP 5xx→RETRYING→FAILED (Req 6.6–6.9; Design §10.2)
- [ ] 1.6.4 Implement AuditLog writing for all Gemini error types; verify no image binary data or PII is logged (Req 6.9)
- [ ] 1.6.5 Verify `IMAGE_ANALYSIS_MODEL` env var is required at startup; fail fast with descriptive error if unset
- [ ] 1.6.6 Write unit tests for analysis worker: state transitions (UPLOADED→QUEUED→PROCESSING→COMPLETED, →RETRYING, →FAILED), safety refusal goes directly to FAILED, retry count incremented correctly
- [ ] 1.6.7 Write property test: for any valid image, analysis worker never transitions from FAILED back to PROCESSING or COMPLETED

### 1.7 Image Analysis Review UI

- [ ] 1.7.1 Implement `GET /api/v1/projects/:id/images/:imageId/analysis`: return ImageAnalysisResult with all fields, AnalysisState per field, and confidence scores (Req 7.1, 7.2; Design §4.6, §6.1)
- [ ] 1.7.2 Implement `PATCH /api/v1/projects/:id/images/:imageId/analysis`: accept user corrections; update field values; set AnalysisState to USER_OVERRIDDEN for modified fields, USER_CONFIRMED for confirmed-unchanged fields; persist to ImageAnalysisResult (Req 7.4, 7.5; Design §4.6, §6.1)
- [ ] 1.7.3 Implement Analysis Review UI: display all fields with confidence scores; visual distinction for AI_INFERRED vs USER_CONFIRMED vs USER_OVERRIDDEN (Req 7.2, 7.3; Design §4.6, §10)
- [ ] 1.7.4 Implement consistency validation on review submission: warn if ApplicationScope conflicts with confirmed isInterior/isExterior classification (Req 7.7)
- [ ] 1.7.5 Write unit tests: PATCH updates AnalysisState correctly, USER_OVERRIDDEN takes precedence over AI_INFERRED in downstream processing, consistency warning fires on scope mismatch
- [ ] 1.7.6 Write integration test: full cycle — AI analysis produces AI_INFERRED fields → user overrides two fields → recommendation engine receives USER_OVERRIDDEN values

### 1.8 Paint Manufacturer and Scope Selection

- [ ] 1.8.1 Implement `GET /api/v1/brands`: return all 4 PaintBrand records with `isActive` flag and catalogue availability indicator for current release (Req 8.1, 8.6; Design §4.7, §6.1)
- [ ] 1.8.2 Implement manufacturer + scope selection UI: 4 manufacturer cards (mark non-MVP ones as "Coming Soon"), ApplicationScope selector (INTERIOR / EXTERIOR / BOTH) (Req 8.1, 8.2, 8.6)
- [ ] 1.8.3 Persist manufacturer and ApplicationScope selections in the `POST /api/v1/projects/:id/recommendations` request payload, validated via Zod schema; ensure only shades from selected manufacturer are eligible (Req 8.3, 8.5)
- [ ] 1.8.4 Write unit tests: selecting a non-active manufacturer returns descriptive error; ApplicationScope accepts, validates, and persists INTERIOR, EXTERIOR, and BOTH (Req 8.1, 8.2, 8.4, 8.5)

### 1.9 MVP Manufacturer Catalogue

- [ ] 1.9.1 Create a catalogue data pipeline script (`scripts/import-catalogue.ts`) that imports a JSON/CSV file of manufacturer shades into `PaintShades` + `PaintShadeSources` + `DataSources`, setting provenance=VERIFIED and requiring a DataSource reference for every shade (Req 12.1, 12.2, 12.5)
- [ ] 1.9.2 Import and verify the MVP catalogue for one Manufacturer (Asian Paints) with VERIFIED provenance; confirm shade name, shade code, colour family, and product linkage for all imported records (Req 12.1, 12.3)
- [ ] 1.9.3 Write CI check: assert that no PaintShade record exists with provenance != VERIFIED in the seed data
- [ ] 1.9.4 Write unit test: recommendation engine returns an error (not a result) if invoked for a Manufacturer with zero VERIFIED active shades

### 1.10 Recommendation Engine

- [ ] 1.10.1 Implement mandatory compatibility filter: exclude PaintShades where provenance != VERIFIED, isActive=false, ApplicationScope incompatible, or surfaceCompatibility has no intersection with detected surfaces (Req 9.1, 9.3, 9.4; Design §7.4)
- [ ] 1.10.2 Implement all nine factor scoring functions (CLIMATE_SUITABILITY, INTERIOR_EXTERIOR_COMPATIBILITY, SURFACE_COMPATIBILITY, PRODUCT_SUITABILITY, ARCHITECTURAL_CHARACTERISTICS, ROOM_TYPE, NATURAL_LIGHT, COLOUR_FAMILY_COMPATIBILITY, USER_PREFERENCES) (Req 9.2; Design §7.1)
- [ ] 1.10.3 Implement composite score calculation: `compositeScore = Σ(factorScore[i] × weight[i])` using active ScoringWeights version (Req 9.3, 9.4; Design §7.2)
- [ ] 1.10.4 Implement deterministic candidate sorting: `compositeScore DESC`, `shadeId ASC` as tie-breaker (Req 9.5; Design §7.5)
- [ ] 1.10.5 Implement Palette Harmony post-scoring rule exactly per Design §8.1: check concentration (≥4 of 5 same colour family), scan positions 6–15, replace position 5 of concentrated family if eligible replacement found, maintain score-descending order; set `isHarmonyReplacement=true` and `replacedCandidateId` (Req 9.6, 9.7)
- [ ] 1.10.6 Implement filter relaxation sequence in exact order: (1) COLOUR_FAMILY_COMPATIBILITY, (2) NATURAL_LIGHT, (3) ROOM_TYPE, (4) ARCHITECTURAL_CHARACTERISTICS; stop when ≥5 candidates available; record applied steps in `relaxationApplied` (Req 9.8, 9.9; Design §9)
- [ ] 1.10.7 Implement fewer-than-five-results response: return available candidates + `relaxationStepsApplied` + `insufficientCandidatesReason` (Req 9.9)
- [ ] 1.10.8 Implement `POST /api/v1/projects/:id/recommendations`: validate inputs, require active project (reject ARCHIVED with 409) and valid ClimateProfile, load active ScoringWeights, run engine, persist RecommendationRun + Recommendations + RecommendationFactors (Req 4.7, 9.10, 9.11; Design §7.3, §7.5, §23.2)
- [ ] 1.10.9 Implement recommendation run rate limiting: enforce `RATE_LIMIT_RECOMMENDATIONS_PER_DAY` (Req 15.1)
- [ ] 1.10.10 Write unit tests for each of the nine scoring functions (Climate Suitability, Interior/Exterior Compatibility, Surface Compatibility, Product Suitability, Architectural Characteristics, Room Type, Natural Light, Colour Family Compatibility, User Preferences): verify score ranges, verify weight application, verify composite score formula
- [ ] 1.10.11 Write unit test for Palette Harmony: concentrated set (4 of same family) triggers replacement from positions 6–15; non-concentrated set is unchanged; no replacement candidate in 6–15 → unchanged
- [ ] 1.10.12 Write unit test for relaxation sequence: verify exact order (COLOUR_FAMILY_COMPATIBILITY first, ARCHITECTURAL_CHARACTERISTICS last); verify engine stops at first step that yields ≥5 candidates
- [ ] 1.10.13 Write property test: for any valid set of inputs to the recommendation engine, the output always contains exactly 0 < n ≤ 5 recommendations, all referencing VERIFIED PaintShades from the selected Manufacturer
- [ ] 1.10.14 Write property test: composite score for any recommendation is always equal to `Σ(factorScore[i] × weight[i])` to within floating-point tolerance (round-trip scoring invariant)
- [ ] 1.10.15 Write property test: re-running the recommendation engine with identical inputs produces identical output (determinism property)

### 1.11 Recommendation Explanation

- [ ] 1.11.1 Implement `GET /api/v1/projects/:id/recommendations/:runId`: return full RecommendationRun with all Recommendations, RecommendationFactors, composite scores, scoringWeightsVersion, relaxationApplied, paletteHarmonyApplied (Req 10.1–10.5; Design §6.1, §7.5, §8.2)
- [ ] 1.11.2 Implement recommendation results UI: display 5 recommendations (or fewer with explanation); per card show shade name, shade code, product name, finish, composite score, per-factor scores, Palette Harmony replacement indicator if applicable; display ScoringWeights version; display relaxation explanation if applicable (Req 10.1–10.5)
- [ ] 1.11.3 Write integration test: full recommendation run → verify response contains 9 factor scores per recommendation, correct composite score, scoringWeightsVersion, and Palette Harmony flag when applicable

### 1.12 Basic Dealer Discovery

- [ ] 1.12.1 Implement `DealerDiscoveryService` using Google Places API (`GOOGLE_PLACES_API_KEY` env var): query by lat/lon + Manufacturer name; return dealer name, address, distance, phone (Req 11.1; Design §14.1)
- [ ] 1.12.2 Implement dealer persistence: store results in `Dealers` + `DealerBrands` with `DealerState=THIRD_PARTY_DISCOVERED`; never auto-assign VERIFIED_OFFICIAL (Req 11.2, 11.3)
- [ ] 1.12.3 Implement `GET /api/v1/dealers?lat=&lon=&brandId=`: return dealer list with DealerState; sort by distance (Req 11.4)
- [ ] 1.12.4 Implement dealer discovery UI: display dealer cards with name, address, distance, DealerState badge (Req 11.4, 11.5)
- [ ] 1.12.5 Write unit test: assert that a Google Places result is always stored as THIRD_PARTY_DISCOVERED, never VERIFIED_OFFICIAL

### 1.13 Wave 1 E2E Vertical Slice

- [ ] 1.13.1 Write E2E test (Playwright or Cypress): Registration → Consent → Login → Create Project → Enter Location (Google Geocoding) → Confirm Location → Climate Profile loads → Upload 2 images → Images reach COMPLETED analysis state → Review Analysis (confirm fields) → Select Manufacturer (MVP catalogue) + EXTERIOR scope → Run Recommendation → View 5 Recommendations with factor scores → View nearby Dealers
- [ ] 1.13.2 Verify E2E test does NOT reference any visualization endpoint, visualization UI component, or ImageGenerationJob — all visualization is Wave 3
- [ ] 1.13.3 Verify E2E test passes with Mappls geocoding client in deferred (inactive) state
- [ ] 1.13.4 Verify Wave 1 baseline performance targets under baseline load (50 concurrent users): LCP < 2.5s, API response p95 < 500ms, recommendation run p95 < 10s, image analysis p95 < 30s (Req 17.1–17.4; Design §21.1)

---

## Wave 2 — Recommendation Depth

### 2.1 Remaining Manufacturer Catalogues

- [ ] 2.1.1 Import and verify catalogue for Birla Opus: shades with VERIFIED provenance, DataSource reference, product linkage
- [ ] 2.1.2 Import and verify catalogue for Nerolac: same standards
- [ ] 2.1.3 Import and verify catalogue for Berger Paints: same standards
- [ ] 2.1.4 Update manufacturer cards in UI: remove "Coming Soon" for newly populated manufacturers
- [ ] 2.1.5 Write CI check: all four manufacturers have at least one VERIFIED active PaintShade

### 2.2 User Preferences

- [ ] 2.2.1 Implement user preferences input UI: preferred colour families, preferred finishes, budget tier, any other configurable preference fields
- [ ] 2.2.2 Persist user preferences per RecommendationRun in the run payload
- [ ] 2.2.3 Implement `USER_PREFERENCES` scoring function using persisted preferences (Req 9.2; Design §7.1)
- [ ] 2.2.4 Write unit tests for USER_PREFERENCES scorer: higher score when shade matches preferred colour family; lower score when no match

### 2.3 BOTH Scope Implementation

- [ ] 2.3.1 Implement separate recommendation lists for INTERIOR and EXTERIOR surfaces when ApplicationScope=BOTH (Req 9.12)
- [ ] 2.3.2 Implement BOTH scope UI: tabbed or split display for interior and exterior recommendation lists
- [ ] 2.3.3 Write integration test: ApplicationScope=BOTH returns two recommendation lists, each containing up to 5 recommendations for their respective surface scope

### 2.4 Multi-Image Aggregation

- [ ] 2.4.1 Implement `CrossImageAggregationService`: majority vote for categorical fields, union for set fields, confidence-weighted tie-breaking, conflict resolution metadata (Req 20.1, 20.2; Design §22.1)
- [ ] 2.4.2 Store project-level synthesis in `ProjectAnalysisSynthesis` table with projectId foreign key and synthesis metadata (Req 20.2; Design §4.24, §22.1)
- [ ] 2.4.3 Update RecommendationEngine to prefer project-level synthesis over per-image results (Req 20.3)
- [ ] 2.4.4 Write unit tests for CrossImageAggregationService: majority vote correctness, union of surfaces, conflict resolution metadata recorded
- [ ] 2.4.5 Write property test: aggregation output for any set of ≥2 per-image results contains union of all detected surfaces

### 2.5 SAM2 Integration (Optional)

- [ ] 2.5.1 Design SAM2 inference service interface as architecturally separable component (Req 20.4; Design §22.2)
- [ ] 2.5.2 Implement SAM2 client with graceful degradation: if SAM2 service unavailable, fall back to Gemini-only region detection
- [ ] 2.5.3 Write integration test: SAM2 unavailable does not cause analysis pipeline failure

### 2.6 Palette Harmony — Full Validation

- [ ] 2.6.1 Write additional property tests for Palette Harmony: output always contains ≤5 recommendations; concentrated-family scenario always produces a replacement when one exists in positions 6–15; idempotency (applying Palette Harmony twice to same sorted list produces same result)
- [ ] 2.6.2 Write property test: Palette Harmony never moves a candidate with a lower composite score above a candidate with a higher composite score except when explicitly replacing to resolve concentration

---

## Wave 3 — Visualization

### 3.1 Source Image Selection

- [ ] 3.1.1 Implement "Visualize this image" button on each COMPLETED ProjectImage card in the recommendation results UI (Req 19.1)
- [ ] 3.1.2 Implement `POST /api/v1/visualization/jobs`: validate `sourceImageId` belongs to authenticated user's Project; validate `recommendationRunId` exists and is COMPLETED; create `ImageGenerationJob` with `projectImageId=sourceImageId` and `geminiModel=process.env.GEMINI_IMAGE_MODEL` (Req 19.1, 19.2; Design §13.1)
- [ ] 3.1.3 Write unit test: visualization job creation with invalid sourceImageId (not owned by user) returns 403

### 3.2 Visualization Worker

- [ ] 3.2.1 Implement `visualization-worker.ts` (BullMQ `visualization-queue`): dequeue job, fetch source image from Blob Storage, call Gemini API (GEMINI_IMAGE_MODEL), handle success/retry/failure (Req 19.3, 19.4; Design §13.2)
- [ ] 3.2.2 Implement Gemini visualization error handling per Design §13.3: timeout→RETRYING, rate limit→RETRYING, safety refusal→load GeminiFallbackPrompt→retry once, safety refusal on fallback→FAILED, permanent failure→FAILED + AuditLog + user notification (Req 19.5, 19.6)
- [ ] 3.2.3 Verify `GEMINI_IMAGE_MODEL` env var is set and loaded independently of `IMAGE_ANALYSIS_MODEL` (Req 19.3)
- [ ] 3.2.4 Implement visualization rate limiting: enforce `RATE_LIMIT_VISUALIZATION_PER_DAY` per user (Req 15.1)
- [ ] 3.2.5 Write unit tests: state transitions (QUEUED→PROCESSING→COMPLETED, →RETRYING, →FAILED), safety refusal on primary prompt activates fallback, safety refusal on fallback sets FAILED

### 3.3 Generated Image Storage and Display

- [ ] 3.3.1 Store GeneratedImage in `generated-images` Blob Storage container; create `GeneratedImage` record linked to job and sourceImageId (Req 19.7)
- [ ] 3.3.2 Implement visualization results UI: display GeneratedImage with shade label; display indicative-preview label when `isIndicative=true` (Req 19.8)
- [ ] 3.3.3 Implement `GET /api/v1/visualization/jobs/:jobId`: return job status and generated image signed URL when COMPLETED
- [ ] 3.3.4 Write integration test: full visualization flow — select image → create job → worker completes → GeneratedImage stored → signed URL returned → UI displays image

### 3.4 GeminiFallbackPrompt Management

- [ ] 3.4.1 Implement admin UI for managing `GeminiFallbackPrompts`: create, activate, deactivate, view prompts
- [ ] 3.4.2 Write unit test: visualization worker loads the active GeminiFallbackPrompt when primary prompt receives safety refusal

### 3.5 Advanced Dealer Verification

- [ ] 3.5.1 Implement `DealerVerificationService`: call manufacturer dealer locator APIs per Manufacturer; match against THIRD_PARTY_DISCOVERED records; upgrade state to VERIFIED_OFFICIAL on match; create DealerVerificationRecord for each attempt (Req 11.3; Design §14.2)
- [ ] 3.5.2 Write unit test: a THIRD_PARTY_DISCOVERED dealer is only upgraded to VERIFIED_OFFICIAL after successful authoritative manufacturer verification

---

## Wave 4 — Operations/Compliance

### 4.1 DSAR and Account Deletion

- [ ] 4.1.1 Implement `POST /api/v1/users/me/dsar`: create DSAR record, write AuditLog, send DSAR_CONFIRMATION email, queue data-export compilation job (Req 13.3; Design §24.3)
- [ ] 4.1.2 Implement data export compilation job: aggregate all personal data for user; produce downloadable export package
- [ ] 4.1.3 Implement `DELETE /api/v1/users/me`: initiate account deletion flow; write AuditLog; send ACCOUNT_DELETION_CONFIRMATION email; queue deletion/anonymization job (Req 13.4; Design §24.3)
- [ ] 4.1.4 Write integration tests: DSAR creates AuditLog entry; account deletion anonymizes personal data within configured retention period

### 4.2 Catalogue Administration

- [ ] 4.2.1 Implement admin UI for PaintShade management: create, approve, deactivate shades with DataSource reference (Req 12.4)
- [ ] 4.2.2 Implement PaintShade approval workflow: new shades require admin approval before provenance=VERIFIED is set (Req 12.2)
- [ ] 4.2.3 Write AuditLog entries for all catalogue approval actions (Req 18.2)

### 4.3 Scoring Weights Administration

- [ ] 4.3.1 Implement admin UI for ScoringWeightVersion: create new version, view version history, set active version (Design §4.25, §7.3)
- [ ] 4.3.2 Write AuditLog entry on every SCORING_WEIGHTS_CHANGED event (Req 18.2)
- [ ] 4.3.3 Write unit test: changing active ScoringWeights version does not retroactively alter completed RecommendationRun results

### 4.4 Audit Log Viewer

- [ ] 4.4.1 Implement admin read-only `GET /api/v1/admin/audit-logs`: paginated, filterable by eventType, userId, date range (Req 18.4)
- [ ] 4.4.2 Write unit test: AuditLog records cannot be modified or deleted via any API endpoint

### 4.5 PDF Export

- [ ] 4.5.1 Implement `GET /api/v1/projects/:id/recommendations/:runId/export/pdf`: generate PDF of recommendation results with shade names, codes, factor scores, Palette Harmony explanation
- [ ] 4.5.2 Write unit test: exported PDF contains all 5 recommendation shades and their manufacturer shade codes

### 4.6 Security Regression Suite

- [ ] 4.6.1 Implement automated security regression test suite covering: IDOR (cross-user project access), Administrator role restrictions (cannot access other users' projects/images per Req 21.3; Design §3.2), verify Guest and Support Agent roles are deferred and inactive (Req 21.4), rate limit enforcement, auth bypass, input validation (SQL injection attempt via Prisma), XSS attempt via project name field (Req 16.4, 16.5, 21.2, 21.3, 21.4)
- [ ] 4.6.2 Verify all 6 secrets categories (Design §16.1) are sourced from env vars / Key Vault in CI environment check

---

## Wave 5 — Production Hardening

### 5.1 Performance Optimization

- [ ] 5.1.1 Add database indexes for high-frequency query patterns: `Projects.userId`, `ProjectImages.projectId + processingState`, `PaintShades.productId + provenance + isActive`, `Recommendations.runId`
- [ ] 5.1.2 Implement CDN (Azure CDN) for static assets; configure cache headers for generated images
- [ ] 5.1.3 Run load test (k6 or Artillery) at 500 concurrent users; verify LCP < 2.5s, API p95 < 800ms, recommendation generation p95 < 15s
- [ ] 5.1.4 Optimize any bottleneck identified by load test

### 5.2 Accessibility

- [ ] 5.2.1 Audit all UI components for WCAG 2.1 AA compliance: focus management, ARIA labels, colour contrast, keyboard navigation
- [ ] 5.2.2 Fix all WCAG 2.1 AA violations found in audit
- [ ] 5.2.3 Document accessibility testing methodology (manual testing with screen reader required for full validation)

### 5.3 Security Hardening

- [ ] 5.3.1 Commission penetration test; remediate all critical and high findings
- [ ] 5.3.2 Verify HSTS header, CSP policy, X-Frame-Options, X-Content-Type-Options in production
- [ ] 5.3.3 Run dependency vulnerability scan (npm audit / Snyk); remediate all critical vulnerabilities

### 5.4 Backup and Restore

- [ ] 5.4.1 Configure Azure SQL automated backups; document and test point-in-time restore procedure
- [ ] 5.4.2 Configure Azure Blob Storage geo-redundant replication for image data

### 5.5 Production Monitoring

- [ ] 5.5.1 Create production monitoring runbook: alert response procedures for error rate, p95 degradation, queue depth alerts
- [ ] 5.5.2 Verify all Application Insights alerts are active in production environment

### 5.6 Final Production Acceptance

- [ ] 5.6.1 Run full Wave 1 E2E test suite against production environment
- [ ] 5.6.2 Verify all four Manufacturer catalogues have VERIFIED shades in production database
- [ ] 5.6.3 Verify no plaintext secrets appear in any log, environment dump, or database record in production
- [ ] 5.6.4 Sign off production acceptance: performance targets met, accessibility audit passed, security scan clear

---

## Traceability Matrix

Every functional requirement maps to one or more implementation tasks, test tasks, and design sections.

| Requirement | Design Section | Implementation Tasks | Test Tasks |
|---|---|---|---|
| Req 1 — Authentication | §3, §4.1, §4.2 | 0.5.1–0.5.4, 1.1.1–1.1.6 | 0.5.5, 0.5.6, 0.5.7, 1.1.7 |
| Req 2 — Project Management | §4.3, §6.1, §23 | 1.2.1–1.2.8 | 1.2.9 |
| Req 3 — Geocoding | §4.4, §12 | 1.3.1–1.3.6 | 1.3.7, 1.3.8 |
| Req 4 — Climate Profile | §4.11, §4.12, §11 | 1.4.1–1.4.5 | 1.4.6, 1.4.7 |
| Req 5 — Image Upload | §4.5, §10.1, §16.3 | 1.5.1–1.5.4 | 1.5.5, 1.5.6 |
| Req 6 — AI Image Analysis | §4.5, §4.6, §5.3, §10 | 1.6.1–1.6.4 | 1.6.5, 1.6.6, 1.6.7 |
| Req 7 — Analysis Review | §4.6, §6.1, §10 | 1.7.1–1.7.4 | 1.7.5, 1.7.6 |
| Req 8 — Manufacturer/Scope Selection | §4.7, §4.8, §7.4, §8 | 1.8.1–1.8.3, 2.3.1 | 1.8.4, 2.3.3 |
| Req 9 — Recommendation Engine | §4.13, §4.14, §4.15, §4.25, §7, §8, §9 | 0.2.27, 1.10.1–1.10.9, 2.2.3, 2.3.1 | 1.10.10–1.10.15, 2.2.4, 2.3.3, 2.6.1, 2.6.2 |
| Req 10 — Recommendation Explanation | §4.14, §4.15, §7.1, §8.2 | 1.11.1–1.11.2, 4.5.1 | 1.11.3, 4.5.2 |
| Req 11 — Dealer Discovery | §4.16, §4.17, §4.18, §14 | 1.12.1–1.12.4, 3.5.1 | 1.12.5, 3.5.2 |
| Req 12 — Catalogue Integrity | §4.9, §4.10, §4.22 | 1.9.1–1.9.2, 2.1.1–2.1.3, 4.2.1–4.2.3 | 1.9.3, 1.9.4, 2.1.5 |
| Req 13 — Privacy / Data Handling | §4.2, §16.3, §19.3, §24 | 1.1.2–1.1.3, 1.5.7, 4.1.1–4.1.3 | 0.6.7, 4.1.4 |
| Req 14 — Email Notifications | §15 | 0.6.1–0.6.6 | 0.6.7 |
| Req 15 — Rate Limiting | §6.2, §17 | 0.4.3, 1.5.2, 1.10.9, 3.2.4 | 0.4.4, 1.5.5 |
| Req 16 — System Security | §16, §18 | 0.1.5, 1.2.7, 5.3.2 | 0.5.5, 4.6.1, 4.6.2, 5.3.1, 5.3.3 |
| Req 17 — Performance Targets | §21 | 5.1.1, 5.1.2, 5.1.4 | 1.13.4, 5.1.3 |
| Req 18 — Audit Logging | §4.23, §19.3 | 0.2.25, 0.5.4, 1.1.2, 1.1.5, 1.1.6, 1.2.7, 1.6.4, 4.1.1, 4.1.3, 4.2.3, 4.3.2, 4.4.1 | 0.4.4, 0.5.7, 1.2.9, 4.4.2 |
| Req 19 — Visualization | §4.19, §4.20, §4.21, §13 | 3.1.1–3.1.2, 3.2.1–3.2.4, 3.3.1–3.3.3, 3.4.1 | 3.1.3, 3.2.3, 3.2.5, 3.3.4, 3.4.2 |
| Req 20 — Multi-Image Aggregation | §4.24, §22 | 0.2.26, 2.4.1–2.4.3, 2.5.1–2.5.2 | 2.4.4, 2.4.5, 2.5.3 |
| Req 21 — Roles and Access Control | §3.2, §4.1, §6 | 0.2.3, 0.5.3, 0.5.4, 1.2.7, 4.2.1, 4.3.1, 4.4.1 | 0.5.7, 4.6.1 |

---

## Dependency Audit Notes

The following dependency constraints are enforced across all tasks:

- Tasks 1.10.1–1.10.15 (Recommendation Engine) depend on: 0.2.13–0.2.17, 0.2.27 (schema migrations), 1.9.1–1.9.2 (catalogue data), 1.4.3 (verified ClimateProfile), 1.7.2 (USER_OVERRIDDEN / USER_CONFIRMED analysis fields). Recommendation runs are rejected with 409 for ARCHIVED projects (1.2.6; Design §23.2) and require a valid ClimateProfile (Req 4.7).
- Tasks 1.6.1–1.6.7 (Image Analysis) depend on: 0.2.7–0.2.8 (ProjectImages + ImageAnalysisResults migrations), 0.4.2 (BullMQ image-analysis-queue), 0.3.1–0.3.2 (Blob Storage). Multiple images in Wave 1 are processed independently (Req 6.10).
- Tasks 3.1–3.4 (Visualization) depend on: 0.2.21–0.2.23 (ImageGenerationJob, GeneratedImage, GeminiFallbackPrompt migrations), 1.5.1 (image upload), 1.10.8 (completed RecommendationRun), 0.4.1 (Redis for visualization-queue), GEMINI_IMAGE_MODEL environment variable (3.2.3).
- Tasks 2.4.1–2.4.5 (Multi-Image Aggregation) depend on: 0.2.26 (ProjectAnalysisSynthesis migration), 1.6.1–1.6.7 (per-image analysis complete).
- Tasks 3.5.1–3.5.2 (Dealer Verification) depend on: 0.2.18–0.2.20 (Dealers, DealerBrands, DealerVerificationRecords migrations), 1.12.1–1.12.2 (third-party discovered dealers).
- Tasks 4.1.1–4.1.4 (DSAR/Deletion) depend on: 0.6.1–0.6.5 (EmailService), 0.2.25 (AuditLogs migration).
- Tasks 4.2.1–4.2.3 (Catalogue Administration) depend on: 0.2.9–0.2.12 (catalogue schema migrations) and 0.2.25 (AuditLogs).
- Tasks 4.3.1–4.3.3 (Scoring Weights Administration) depend on: 0.2.27 (ScoringWeightVersion migration), 1.10.3 (ScoringWeights engine configuration) and 0.2.25 (AuditLogs).
- Wave 1 E2E test (1.13.1) depends on: all tasks 1.1–1.12 being complete.
- Wave 1 E2E test must NOT depend on any Wave 3 tasks (visualization UI, visualization-worker, or ImageGenerationJob).

---

## Environment Variables Reference

All environment variables required across waves. All secrets must be in Azure Key Vault / env vars — never in SystemConfig DB records.

| Variable | Wave | Secret | Description |
|---|---|---|---|
| DATABASE_URL | 0 | Yes | Azure SQL connection string |
| REDIS_URL | 0 | Yes | Azure Redis connection string |
| AZURE_STORAGE_CONNECTION_STRING | 0 | Yes | Blob Storage connection string |
| ENTRA_CLIENT_ID | 0 | Yes | Entra External ID app client ID |
| ENTRA_CLIENT_SECRET | 0 | Yes | Entra External ID app client secret |
| ENTRA_TENANT_ID | 0 | Yes | Entra External ID tenant ID |
| NEXTAUTH_SECRET | 0 | Yes | Auth.js session secret |
| NEXTAUTH_URL | 0 | No | Base URL of the application |
| EMAIL_PROVIDER | 0 | No | "sendgrid" or "azure_communication" |
| SENDGRID_API_KEY | 0 | Yes | SendGrid API key |
| AZURE_EMAIL_CONNECTION_STRING | 0 | Yes | Azure Communication Services connection string |
| EMAIL_FROM_ADDRESS | 0 | No | Sender email address |
| EMAIL_RETRY_COUNT | 0 | No | Number of email delivery retries (default: 3) |
| GOOGLE_GEOCODING_API_KEY | 1 | Yes | Google Geocoding API key |
| GOOGLE_PLACES_API_KEY | 1 | Yes | Google Places API key |
| MAPPLS_API_KEY | 1 | Yes | Mappls API key (deferred, not active in Wave 1) |
| IMAGE_ANALYSIS_MODEL | 1 | No | Gemini model name for image analysis |
| GEMINI_API_KEY | 1 | Yes | Gemini API key |
| GEMINI_IMAGE_MODEL | 3 | No | Gemini model name for visualization (Wave 3) |
| IMAGE_ANALYSIS_TIMEOUT_MS | 1 | No | Gemini analysis timeout in ms (default: 25000) |
| CLIMATE_RETRY_COUNT | 1 | No | Open-Meteo retry count (default: 3) |
| MAX_IMAGE_SIZE_BYTES | 1 | No | Maximum upload file size in bytes |
| RATE_LIMIT_API_PER_MINUTE | 0 | No | API rate limit per user per minute (default: 300) |
| RATE_LIMIT_UPLOADS_PER_DAY | 1 | No | Upload rate limit per user per day (default: 20) |
| RATE_LIMIT_RECOMMENDATIONS_PER_DAY | 1 | No | Recommendation run rate limit (default: 10) |
| RATE_LIMIT_VISUALIZATION_PER_DAY | 3 | No | Visualization job rate limit (default: 5) |
| PRIVACY_POLICY_VERSION | 0 | No | Current privacy policy version string |

---
