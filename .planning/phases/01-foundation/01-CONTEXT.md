# Phase 01: Foundation - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Source:** Ingested Specifications (`.kiro/specs/paint-platform` & `.planning/intel/`)

<domain>
## Phase Boundary

Phase 1 establishes the foundational infrastructure, repository setup, and data layer for V.A.R.N.A.K.:
- Next.js 14 App Router project setup with TypeScript, ESLint, Prettier, and Husky pre-commit hooks.
- GitHub Actions CI/CD pipeline configuration targeting Azure App Service staging and production slots.
- Azure Key Vault configuration and environment secrets management (`.env.example`).
- Azure SQL Database provisioning and Prisma 5 ORM configuration for Microsoft SQL Server.
- Initial Prisma migrations covering all 25 models from Design §4: Users, UserProfiles, Projects, ProjectLocations, ProjectImages, ImageAnalysisResults, PaintBrands, PaintProducts, PaintShades, PaintShadeSources, ClimateProfiles, ClimateObservations, RecommendationRuns, Recommendations, RecommendationFactors, Dealers, DealerBrands, DealerVerificationRecords, ImageGenerationJobs, GeneratedImages, GeminiFallbackPrompts, DataSources, AuditLogs, ProjectAnalysisSynthesis, ScoringWeightVersion.
- Azure Blob Storage client and private container initialization for uploads (`project-images`) and generated visuals (`generated-images`).
- Azure Cache for Redis integration and BullMQ worker architecture setup (`image-analysis-queue` and `recommendation-queue` per Task 0.4.2; `visualization-queue` belongs to Wave 3).
- Structured JSON logging with correlation IDs and base sliding-window rate limiting middleware.
- EmailService abstraction with SendGrid or Azure Communication Services provider adapters.
- Authentication Setup (Task 0.5): Microsoft Entra External ID app registration, Auth.js v5 OIDC integration, session protection middleware for `/api/v1/*`, post-login callback handler with User upsert and AuditLog events, CI schema check for no password fields, and AUTH_PROVIDER=EntraExternalID invariant tests.

</domain>

<decisions>
## Implementation Decisions

### Project & Framework
- Next.js 14 (App Router) with React 18, TypeScript, and Tailwind CSS (DEC-01).
- Server components and Client components cleanly separated.
- Centralized configuration service validating required environment variables with Zod at runtime startup.

### Identity & Authentication Foundation
- Microsoft Entra External ID is the sole identity authority (DEC-02).
- Auth.js v5 configured as the OIDC client session layer.
- Database stores only internal identifiers, external subject ID, email, role, and profile metadata; passwords are never stored.

### Database & Storage Architecture
- Azure SQL Database (SQL Server) with Prisma 5 ORM (DEC-03).
- Prisma schema defining exactly the 25 models from Design §4 with strict relational integrity, enums, and indexes.
- Azure Blob Storage private container with SAS token generation for client uploads (DEC-04).

### Caching, Queues & Reliability
- Azure Cache for Redis with BullMQ queues: `image-analysis-queue` and `recommendation-queue` (DEC-05, Tasks §0.4.2). Worker process entrypoint `analysis-worker.ts`.
- Worker processes running with retry policies (3 attempts, exponential backoff) and dead-letter queue routing.
- Sliding window rate limiting middleware using Redis atomic counters (REQ-15).

### Observability & Security
- Tamper-evident structured audit logging recording critical events (REQ-18).
- Secrets strictly managed in Azure Key Vault via App Service Key Vault references (REQ-16).
- Zero plaintext credentials or hardcoded keys in repository.

### the agent's Discretion
- Local development support with docker-compose for SQL Server, Redis, and Azurite to enable offline/local testing.
- Vitest unit test runner setup with mock abstractions for Azure Blob and Redis.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Specification
- `.kiro/specs/paint-platform/design.md#1-architecture-overview` — Core architecture overview
- `.kiro/specs/paint-platform/design.md#2-technology-stack` — Complete technology stack definitions
- `.kiro/specs/paint-platform/design.md#4-database-schema` — Full relational database schema definition (25 models)
- `.kiro/specs/paint-platform/design.md#16-security-design` — Security, Key Vault, and credential handling
- `.kiro/specs/paint-platform/design.md#17-rate-limiting-design` — Redis rate limiting specifications
- `.kiro/specs/paint-platform/design.md#19-observability-and-logging` — Structured JSON logging and audit events
- `.kiro/specs/paint-platform/tasks.md#wave-0--foundation` — Tasks breakdown for Wave 0 Foundation (Tasks 0.1–0.8)
- `.planning/intel/decisions.md` — Locked architectural decisions (DEC-01 to DEC-09)
- `.planning/intel/constraints.md` — Architectural constraints and contracts (CON-01 to CON-08)

</canonical_refs>

<specifics>
## Specific Ideas

- Ensure Prisma schema accurately maps SQL Server types (e.g. `DateTime`, `NVarChar`, `Float`).
- Provide seed script (`prisma/seed.ts`) to populate the 4 `PaintBrand` records (Asian Paints, Birla Opus, Nerolac, Berger Paints) and initial `DataSource` records per Task 0.2.27.
- BullMQ worker architecture should allow running as a separate worker process (`analysis-worker.ts`).

</specifics>

<deferred>
## Deferred Ideas

- Wave 1 MVP features (Entra login UI, geocoding endpoints, Open-Meteo client, Gemini Vision prompt execution, recommendation engine UI).
- Wave 3 features (`visualization-queue`, `visualization-worker.ts`, Gemini Image Generation).
- Mappls Geocoding API client (deferred to v2).
- SAM2 advanced segmentation (deferred to v2).

</deferred>
