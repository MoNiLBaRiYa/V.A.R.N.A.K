# Phase 02: MVP Core & E2E Vertical Slice - Context

**Gathered:** 2026-09-25  
**Status:** Ready for planning (Reconciled)  
**Source:** Ingested Specifications (`.kiro/specs/paint-platform/requirements.md`, `design.md`, `tasks.md`, `.planning/intel/`)

<domain>
## Phase Boundary

Phase 2 delivers the complete end-to-end MVP vertical slice for V.A.R.N.A.K., enabling a user to progress from authentication through property creation, climate profiling, photo analysis, review, 9-factor recommendation generation with verified Asian Paints shades, and dealer discovery:
- **Authentication & User Profile**: Entra External ID sign-up/sign-in UI, privacy policy & AI disclosure consent (`POST /api/v1/auth/consent`), and session management.
- **Project Workspace**: Full project lifecycle (`POST /api/v1/projects`, `GET /api/v1/projects`, `GET /api/v1/projects/archived`, `POST /api/v1/projects/:id/archive`, `POST /api/v1/projects/:id/unarchive`, `PATCH /api/v1/projects/:id`, ownership authorization guard).
- **Location & Geocoding**: Google Geocoding integration with address resolution, interactive confirmation UI, and provenance tagging (`USER_PROVIDED`, `VERIFIED`).
- **Climate Profiling**: Open-Meteo monthly climate metrics retrieval (temperature, humidity, rainfall, UV, wind), regional fallback data source, and `ClimateProfile` persistence.
- **Image Upload**: Multipart image upload to Azure Blob Storage via SAS, MIME/size validation, rate limiting (20 uploads/day), and BullMQ queueing (`image-analysis-queue`).
- **AI Image Analysis**: Asynchronous Gemini Vision analysis worker (`analysis-worker.ts`), structured JSON extraction of architecture, lighting, room type, and paintable surfaces, error classification (retry/backoff vs safety refusal). Strict 1:1 non-null relation: `ImageAnalysisResult.projectImageId` to `ProjectImage`.
- **Analysis Review UI**: Interactive review UI displaying confidence scores and distinct badges for `AI_INFERRED`, `USER_CONFIRMED`, and `USER_OVERRIDDEN` (`PATCH /api/v1/projects/:id/images/:imageId/analysis`).
- **Catalogue & Scope Selection**: Manufacturer card selection (Asian Paints active; Birla Opus, Nerolac, Berger Paints marked "Coming Soon"), application scope (`INTERIOR`, `EXTERIOR`, `BOTH` accepted, validated, and persisted), and verified Asian Paints shade catalogue pipeline (`scripts/import-catalogue.ts`).
- **9-Factor Recommendation Engine**: Rigorous implementation of all 9 scoring functions (`CLIMATE_SUITABILITY`, `INTERIOR_EXTERIOR_COMPATIBILITY`, `SURFACE_COMPATIBILITY`, `PRODUCT_SUITABILITY`, `ARCHITECTURAL_CHARACTERISTICS`, `ROOM_TYPE`, `NATURAL_LIGHT`, `COLOUR_FAMILY_COMPATIBILITY`, `USER_PREFERENCES`), active `ScoringWeightVersion` composite scoring, deterministic sorting, palette harmony diversity replacement (Design §8.1), and progressive filter relaxation (Design §9).
- **Results UI & Explanations**: Displaying top 5 recommendations with factor breakdowns, natural language explanations, and provenance indicators.
- **Dealer Discovery**: Nearby dealer discovery via Google Places API around coordinates, persisting dealers strictly with `THIRD_PARTY_DISCOVERED` state.
- **E2E Test Suite**: Integration test verifying the entire vertical slice without mock shortcuts and with zero Wave 3 visualization code.
</domain>

<decisions>
## Implementation Decisions

### Relational Schema (25 Models)
- The resolved 25-model Prisma schema (Design §4) is authoritative across all Phase 2 plans.
- `ImageAnalysisResult.projectImageId` is a strict, non-null, unique 1:1 relation to `ProjectImage`. It is NEVER made nullable.
- `ProjectAnalysisSynthesis` (Model 24) is the future multi-image whole-home synthesis boundary; it is preserved in schema but NOT executed in Phase 2 (strictly Wave 2 / Phase 3).
- `ScoringWeightVersion` (Model 25) contains the versioned scoring weights associated with `RecommendationRun`, preserving an immutable snapshot. Changes to weights create new versions and log `SCORING_WEIGHTS_CHANGED` to `AuditLog`.

### Identity & Privacy Consent
- Entra External ID is sole authority (DEC-02).
- First-time users MUST accept both Privacy Policy and AI disclosure checkboxes before completing onboarding (REQ-01, REQ-14).
- Archived projects are read-only: updates (`PATCH`) and uploads (`POST /images`) to archived projects reject with HTTP 409 Conflict (REQ-02, Design §23.2).

### Geocoding & Climate Engine
- `GoogleGeocodingClient` is the sole active geocoder in Wave 1. `MapplsGeocodingClient` is deferred (`isActive: false`).
- Coordinates are NOT persisted until confirmed by the user in the UI (REQ-03).
- `ClimateService` queries Open-Meteo; if unavailable after retries, uses regional aggregate data tagged with `DERIVED` provenance and sets `climateDataNote` in response.
- Recommendation generation is blocked if climate data is completely unavailable (REQ-04).

### Vision & Queue Discipline
- Image upload enforces max 10MB file size, valid MIME (`image/jpeg`, `image/png`, `image/webp`), and magic byte verification (REQ-05).
- Queue architecture is strictly limited to `image-analysis-queue` and `recommendation-queue`. NO visualization queue is introduced.
- Analysis runs asynchronously via BullMQ `image-analysis-queue` processed by `src/workers/analysis-worker.ts`.
- Gemini model is configured via `IMAGE_ANALYSIS_MODEL` env var (default: `gemini-1.5-pro`). Safety refusals transition job directly to `FAILED` with recorded refusal reason without retry (REQ-06).

### Recommendation Rules & Architecture
- Exactly nine scoring factors are implemented in MVP:
  1. `CLIMATE_SUITABILITY`
  2. `INTERIOR_EXTERIOR_COMPATIBILITY`
  3. `SURFACE_COMPATIBILITY`
  4. `PRODUCT_SUITABILITY`
  5. `ARCHITECTURAL_CHARACTERISTICS`
  6. `ROOM_TYPE`
  7. `NATURAL_LIGHT`
  8. `COLOUR_FAMILY_COMPATIBILITY`
  9. `USER_PREFERENCES`
- In MVP, `USER_PREFERENCES` computes a neutral baseline score of `0.5` when explicit preferences are unconfigured. Advanced preference questionnaires, preference sliders, and user-facing preference configuration forms belong strictly to Phase 3 (Wave 2) and must NOT be pulled into Phase 2.
- `COLOUR_FAMILY_COMPATIBILITY` is factor #8 of the 9-factor engine and is implemented in the same MVP scoring engine in Plan 02-05.
- Palette Harmony is a post-scoring rule, NOT a scoring factor (Design §7.1, §8.1). It executes after composite scoring and does NOT modify factor scores or composite scores.
- Composite score formula: `Σ(factorScore[i] × weight[i])` loaded from active `ScoringWeightVersion` (`v1.0.0`).
- Tie-breaking: `compositeScore DESC`, then `shadeId ASC`.
- Relaxation order is strictly sequential: (1) Colour Family, (2) Natural Light, (3) Room Type, (4) Architectural Characteristics.
- `ApplicationScope`: Wave 1 accepts, validates, and persists `BOTH` but does not generate recommendations. Recommendation behavior for `BOTH` is defined only in the recommendation-engine plan according to the authoritative Requirements.md, Design.md, and Tasks.md (where the MVP recommendation engine generates a single ranked list of 5 recommendations for `BOTH`). Separate Interior and Exterior recommendation lists remain deferred to the later phase specified by those documents.

### Manufacturer & Dealer Provenance Boundaries
- Asian Paints is the sole active manufacturer (`isActive: true`, `hasCatalogue: true`). Birla Opus, Nerolac, and Berger Paints are marked "Coming Soon" (`hasCatalogue: false`).
- Discovered dealers from Google Places are persisted strictly as `DealerState=THIRD_PARTY_DISCOVERED` (`isClaimed: false`, `isAuthorized: false`). They must NEVER be marked `VERIFIED_OFFICIAL`.
</decisions>

<canonical_refs>
## Canonical References

- `.kiro/specs/paint-platform/requirements.md` — Reqs 1 through 12, 14, 15, 16, 18
- `.kiro/specs/paint-platform/design.md#3-authentication-architecture` — §3 Auth flows & audit events
- `.kiro/specs/paint-platform/design.md#4-database-schema` — §4 Authoritative 25-model Prisma schema
- `.kiro/specs/paint-platform/design.md#5-component-architecture` — §5 Core services
- `.kiro/specs/paint-platform/design.md#6-api-design` — §6 API specifications & rate limits
- `.kiro/specs/paint-platform/design.md#7-recommendation-engine-design` — §7 9-factor scoring formulas
- `.kiro/specs/paint-platform/design.md#8-palette-harmony-rule` — §8 Diversity post-filtering rule
- `.kiro/specs/paint-platform/design.md#9-filter-relaxation-algorithm` — §9 Fallback relaxation sequence
- `.kiro/specs/paint-platform/design.md#10-ai-image-analysis` — §10 Gemini Vision prompt & state machine
- `.kiro/specs/paint-platform/design.md#11-climate-profile-retrieval` — §11 Open-Meteo & regional aggregates
- `.kiro/specs/paint-platform/design.md#12-geocoding-service` — §12 Google Geocoding & confirmation flow
- `.kiro/specs/paint-platform/design.md#14-dealer-discovery` — §14 Google Places dealer discovery
- `.kiro/specs/paint-platform/tasks.md#wave-1--mvp` — Tasks 1.1 through 1.13
</canonical_refs>

<deferred>
## Deferred Ideas

- Generative preview rendering via Gemini Image Generation (`ImageGenerationJob`, `visualization-queue`) — Strictly Wave 3 (Phase 4).
- Multi-image whole-home synthesis (`ProjectAnalysisSynthesis`) — Strictly Wave 2 (Phase 3).
- Dual separate recommendation lists for `ApplicationScope=BOTH` — Strictly Wave 2 (Phase 3).
- User preference configuration UI & deep weighting customization — Strictly Wave 2 (Phase 3).
- Catalogues for Birla Opus, Nerolac, and Berger Paints — Strictly Wave 2 (Phase 3).
- Mappls Geocoding API client — Deferred to v2.
- SAM2 wall segmentation — Deferred to v2.
</deferred>
