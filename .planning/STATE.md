# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-22)

**Core value:** Delivering scientifically grounded, climate-durable, and architecturally harmonious paint recommendations using strictly verified manufacturer shade codes, substantiated by AI property vision analysis and photorealistic previews.
**Current focus:** Phase 1: Foundation

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 0 of 4 in current phase
Status: BLOCKED (Source contradictions in database schema and scoring weights)
Last activity: 2026-09-22 — Completed strict audit of planning artifacts against source documents

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 0/4 | - | - |
| 2. MVP Core & E2E Vertical Slice | 0/5 | - | - |
| 3. Recommendation Depth & Multi-Image | 0/3 | - | - |
| 4. Generative Visualization | 0/2 | - | - |
| 5. Operations, Compliance & Administration | 0/3 | - | - |
| 6. Production Hardening & Acceptance | 0/2 | - | - |

**Recent Trend:**
- Last 5 plans: None
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in `PROJECT.md` Key Decisions table.
Recent decisions affecting current work:

- [Phase 1]: Next.js 14 App Router with TypeScript and ESLint (DEC-01)
- [Phase 1]: Microsoft Entra External ID with Auth.js v5 as sole identity authority (DEC-02)
- [Phase 1]: Azure SQL Database with Prisma 5 ORM for type-safe schema and migrations (DEC-03)
- [Phase 1]: Azure Blob Storage for media asset storage with private SAS authorization (DEC-04)
- [Phase 1]: Azure Cache for Redis and BullMQ for async queues and sliding window rate limiting (DEC-05)

### Pending Todos

None yet.

- **[BLOCKER 1]** Design §4.6 (`ImageAnalysisResult.projectImageId String @unique` non-null) contradicts Design §22 (project-level synthesis with `projectImageId = null`).
- **[BLOCKER 2]** Requirements §9, §18, and Design §7.3 require versioned/persistent `ScoringWeights`, but Design §4 defines only 23 models with no `ScoringWeights` table. RecommendationRun (§4.13) stores only `scoringWeightsVersion String`.
- **[WARNING 1]** Project archive API method mismatch: Design §6.1 (`POST`) vs Design §23.1 (`PATCH`).
- **[WARNING 2]** Design §4.17 `DealerBrand.brandId` lacks Prisma `@relation` to `PaintBrand`.
- **[WARNING 3]** Tasks §1.8.4 expects BOTH scope unit test in Wave 1, while BOTH recommendation implementation is scoped to Wave 2 (Tasks §2.3).

## Deferred Items

Items acknowledged from planning specifications:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Geocoding | Mappls Geocoding API client | Deferred to v2 | Requirements §3 / Design §12 |
| Image Segmentation | SAM2 interactive wall polygon segmentation | Deferred to v2 | Requirements §6 / Design §10 |

## Session Continuity

Last session: 2026-09-22
Stopped at: Completed document ingestion bootstrap from .kiro/specs/paint-platform/. Ready to plan Phase 1.
Resume file: None
