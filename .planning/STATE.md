# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-22)

**Core value:** Delivering scientifically grounded, climate-durable, and architecturally harmonious paint recommendations using strictly verified manufacturer shade codes, substantiated by AI property vision analysis and photorealistic previews.
**Current focus:** Phase 2: MVP Core & E2E Vertical Slice

## Current Position

Phase: 2 of 6 (MVP Core & E2E Vertical Slice)
Plan: 1 of 5 in current phase (Wave 1 Complete; Next: Wave 2 Plans 02-02 & 02-03)
Status: IN_PROGRESS (Wave 1 executed and verified; Next: Wave 2 Geocoding, Climate & Image Ingestion)
Last activity: 2026-09-25 — Executed Plan 02-01 (Auth UI, Consent & Project Workspace CRUD), 30/30 tests passing, Next.js build succeeding

Progress: [█████░░░░░] 26% (5 of 19 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: ~20m
- Total execution time: ~1.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 4/4 | 1.4h | 21m |
| 2. MVP Core & E2E Vertical Slice | 1/5 | 0.3h | 18m |
| 3. Recommendation Depth & Multi-Image | 0/3 | - | - |
| 4. Generative Visualization | 0/2 | - | - |
| 5. Operations, Compliance & Administration | 0/3 | - | - |
| 6. Production Hardening & Acceptance | 0/2 | - | - |

**Recent Trend:**
- Last 4 plans: 01-01, 01-02, 01-03, 01-04
- Trend: Complete

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in `PROJECT.md` Key Decisions table.
Recent decisions affecting current work:

- [Phase 1]: Next.js 14 App Router with TypeScript and ESLint (DEC-01)
- [Phase 1]: Microsoft Entra External ID with Auth.js v5 as sole identity authority (DEC-02)
- [Phase 1]: Azure SQL Database with Prisma 5 ORM for type-safe schema and migrations across 25 models (DEC-03)
- [Phase 1]: Azure Blob Storage for media asset storage with private SAS authorization (DEC-04)
- [Phase 1]: Azure Cache for Redis and BullMQ for async queues and sliding window rate limiting (DEC-05)

### Resolved Blockers & Warnings (All 5 Resolved)

- **[RESOLVED] Blocker 1 (Synthesis Model)**: Design §4.6 (`ImageAnalysisResult.projectImageId String @unique` non-null) preserved; dedicated `ProjectAnalysisSynthesis` model (§4.24, Tasks §0.2.26) created for multi-image synthesis.
- **[RESOLVED] Blocker 2 (Scoring Weights)**: `ScoringWeightVersion` model (§4.25, Tasks §0.2.27) created with unique version string, 9-factor JSON weights, `isActive` flag, and AuditLog event; referenced by `RecommendationRun.scoringWeightsVersionId`. Total database models: exactly 25.
- **[RESOLVED] Warning 1 (Archive Method)**: Standardized on `POST /api/v1/projects/:id/archive` and `POST /api/v1/projects/:id/unarchive` across Design §6.1, Tasks §1.2.4/§1.2.5, and Design §23.1.
- **[RESOLVED] Warning 2 (DealerBrands Relation)**: Explicit foreign key relation `brand PaintBrand @relation(fields: [brandId], references: [id])` on `DealerBrand` and back-relation `dealers DealerBrand[]` on `PaintBrand` added to Prisma schema (Design §4.7, §4.17; Tasks §0.2.19).
- **[RESOLVED] Warning 3 (ApplicationScope=BOTH Scope)**: Requirements (Req 8.4, 9.12) and Tasks §1.8.4 aligned: Wave 1 accepts, validates, and persists `INTERIOR`, `EXTERIOR`, and `BOTH`. Wave 2 implements and tests dual recommendation list generation (Tasks §2.3).
- **Remaining Contradictions**: **0** (Zero).

## Deferred Items

Items acknowledged from planning specifications:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Geocoding | Mappls Geocoding API client | Deferred to v2 | Requirements §3 / Design §12 |
| Image Segmentation | SAM2 interactive wall polygon segmentation | Deferred to v2 | Requirements §6 / Design §10 |

## Session Continuity

Last session: 2026-09-23
Stopped at: Architecture revision complete. All 25 models aligned across source documents and planning artifacts. Phase 1 readiness: READY.
Resume file: None
