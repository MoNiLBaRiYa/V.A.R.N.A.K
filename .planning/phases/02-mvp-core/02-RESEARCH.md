# Phase 02: MVP Core & E2E Vertical Slice - Research

**Phase:** 02-mvp-core  
**Researched:** 2026-09-25  
**Status:** Completed (Reconciled)  

---

## 1. External Integrations & APIs

### 1.1 Google Geocoding API
- **Endpoint**: `https://maps.googleapis.com/maps/api/geocode/json`
- **Method**: GET with `address` and `key` query parameters.
- **Handling**: Supports address text, locality, and 6-digit Indian PIN codes.
- **Response**: Extracts `formatted_address`, `geometry.location.lat`, and `geometry.location.lng`.
- **Confirmation Boundary**: Coordinates are returned to the client for user confirmation and are NOT written to `ProjectLocation` until confirmed via `POST /api/v1/projects/:id/location/confirm`.
- **Mappls Geocoding**: Stubbed with `isActive: false` as per CON-07 and Design §12.1.

### 1.2 Open-Meteo Climate API & Regional Fallback
- **Primary Source**: Open-Meteo Archive/Climate API (`https://archive-api.open-meteo.com/v1/archive`). Free, no API key required.
- **Metrics Collected**: 12 monthly observation points containing average temperature (°C), relative humidity (%), precipitation (mm), estimated UV index, and wind speed (km/h).
- **Retry & Fallback**: Retries up to 3 times with exponential backoff. If unavailable, falls back to the bundled static regional dataset (`src/data/regional-climate.json`) tagged as `DERIVED` provenance.
- **Notification**: When `DERIVED` provenance is assigned, the API response includes `climateDataNote: "Regional average climate data was used. Local conditions may vary."`.
- **Gating**: If climate data is completely unavailable, paint recommendation runs are blocked with HTTP 422 Unprocessable Entity.

### 1.3 Google Gemini Vision (Image Analysis)
- **Model**: Controlled via `IMAGE_ANALYSIS_MODEL` environment variable (default: `gemini-1.5-pro`).
- **Prompt Structure**: Instructs Gemini to inspect residential exterior or interior photos and output strict JSON schema:
  - `spaceType`: 'EXTERIOR' | 'INTERIOR' | 'ROOM'
  - `isInterior`: boolean
  - `facadeType`: string (e.g. 'BUNGALOW', 'APARTMENT', 'ROW_HOUSE', 'MODERN')
  - `architecturalStyle`: string (e.g. 'COLONIAL', 'CONTEMPORARY', 'TRADITIONAL_INDIAN', 'MINIMALIST')
  - `visibleSurfaces`: list of surfaces detected (e.g. ['CONCRETE', 'WOOD', 'BRICK', 'PLASTER', 'GLASS'])
  - `naturalLightQuality`: 'DIRECT_SUNLIGHT' | 'MODERATE' | 'SHADED' | 'DIFFUSED'
  - `paintableRegions`: list of identified wall/trim areas
  - Confidence scores (0.0 to 1.0) for inferred attributes.
- **Error Taxonomy**:
  - `TIMEOUT` / `QUOTA` / `5XX`: Retry up to 3 times with backoff.
  - `SAFETY_REFUSAL`: Terminate immediately to `FAILED` state, log reason in `safetyRefusalReason`, record in `AuditLog`, zero retries.
- **Relational Invariant**: `ImageAnalysisResult.projectImageId` is a strict, non-null, unique 1:1 foreign key to `ProjectImage`. Multi-image whole-home synthesis is managed by `ProjectAnalysisSynthesis` in Phase 3.

### 1.4 Google Places API (Dealer Discovery)
- **Endpoint**: `https://maps.googleapis.com/maps/api/place/nearbysearch/json`
- **Search Query**: Latitude, longitude, `radius=15000` (15km), keyword="Asian Paints dealer".
- **Storage Rule**: Discovered dealers are persisted with `DealerState=THIRD_PARTY_DISCOVERED`. They must NEVER be marked `VERIFIED_OFFICIAL` by this discovery pipeline.

### 1.5 Database & Queue Boundaries
- **Prisma Schema (25 Models)**: All models from Design §4 are present. Specifically:
  - Model 24 (`ProjectAnalysisSynthesis`): Persists multi-image analysis synthesis; deferred to Wave 2 (Phase 3).
  - Model 25 (`ScoringWeightVersion`): Persists versioned scoring configurations (active version `v1.0.0`) referenced by `RecommendationRun`.
- **Queue Architecture**: Limited strictly to `image-analysis-queue` and `recommendation-queue`. NO visualization queue (`visualization-queue`) or `ImageGenerationJob` exists in Phase 2.

---

## 2. 9-Factor Recommendation Algorithm Design (§7, §8 & §9)

### 2.1 The Exactly Nine Scoring Factors
Every active shade from the selected manufacturer (Asian Paints for MVP) is evaluated across **exactly nine** normalized scoring functions returning values between `0.0` and `1.0`:
1. **Climate Suitability (`CLIMATE_SUITABILITY`)**: Evaluates paint durability against local humidity, UV index, and rainfall (e.g. weather-proof exterior emulsions score high in high-rain/UV regions).
2. **Interior/Exterior Compatibility (`INTERIOR_EXTERIOR_COMPATIBILITY`)**: Validates product application scope against property surface orientation.
3. **Surface Compatibility (`SURFACE_COMPATIBILITY`)**: Jaccard index or intersection between paint product compatibility and detected wall substrate (plaster, concrete, masonry).
4. **Product Suitability (`PRODUCT_SUITABILITY`)**: Evaluation of finish durability, sheen level, and warranty grade.
5. **Architectural Characteristics (`ARCHITECTURAL_CHARACTERISTICS`)**: Alignment between shade undertone and building style.
6. **Room Type (`ROOM_TYPE`)**: Appropriateness for room function (for interior spaces: bedroom, kitchen, living room).
7. **Natural Light (`NATURAL_LIGHT`)**: Compensation for light intensity (e.g., reflective lighter tones in north-facing/shaded rooms; deeper saturated tones in bright southern exposures).
8. **Colour Family Compatibility (`COLOUR_FAMILY_COMPATIBILITY`)**: Complementary harmony with fixed surroundings (roofing, window trims, vegetation). Unambiguously included in the MVP engine.
9. **User Preferences (`USER_PREFERENCES`)**: Explicit preference matching. In MVP, evaluates to neutral baseline `0.5` when explicit preferences are unconfigured. Advanced preference questionnaires and weighting sliders belong strictly to Wave 2 (Phase 3).

### 2.2 Composite Score & Sorting
$$\text{compositeScore} = \sum_{i=1}^{9} (S_i \times W_i)$$
Where weights $W_i$ are loaded from the active `ScoringWeightVersion` (`v1.0.0`), summing strictly to 1.0.
- **Tie-Breaking**: Sorted by `compositeScore DESC`, then `shadeId ASC`.

### 2.3 Strict 9-Step Engine Execution Sequence
1. **Load Active Shades**: Load all active `PaintShade` records for Asian Paints (`provenance == VERIFIED`, `isActive == true`).
2. **Apply Mandatory Filters**:
   - `PaintShade.provenance == VERIFIED`
   - `PaintShade.isActive == true`
   - `PaintProduct.applicationScope` compatible with selected `ApplicationScope`
   - `PaintProduct.surfaceCompatibility` intersects with detected surfaces in `ImageAnalysisResult`
3. **Compute Factor Scores**: For each eligible candidate, compute all 9 factor scores ($S_1 \dots S_9$).
4. **Compute Composite Score**: $\text{compositeScore} = \sum_{i=1}^{9} (S_i \times W_i)$ using active `ScoringWeightVersion`.
5. **Deterministic Sort**: Sort candidates by `compositeScore DESC`, then `shadeId ASC`.
6. **Apply Palette Harmony Post-Scoring Rule**:
   - Examine the top 5 candidates.
   - If $\ge 4$ candidates share the same `colourFamily`:
     - Scan positions 6–15 (inclusive) for the highest-scoring candidate from a different colour family passing mandatory filters.
     - If found: remove the lowest-ranked (rank 5) member belonging to the concentrated family; insert replacement candidate; re-rank top 5 in `compositeScore DESC` order.
     - Set `Recommendation.isHarmonyReplacement = true` and `replacedCandidateId`.
     - Set `RecommendationRun.paletteHarmonyApplied = true`.
     - *Note*: Palette Harmony does NOT modify factor scores or composite scores.
7. **Filter Relaxation Sequence** (if $< 5$ candidates remain after steps 2–6):
   - Relax criteria sequentially in exact design order:
     1. Relax `COLOUR_FAMILY_COMPATIBILITY`
     2. Relax `NATURAL_LIGHT`
     3. Relax `ROOM_TYPE`
     4. Relax `ARCHITECTURAL_CHARACTERISTICS`
   - Halt at first step yielding $\ge 5$ candidates and log in `relaxationApplied`.
8. **Persist Recommendations & Factors**: Save top 5 `Recommendation` and 45 `RecommendationFactor` (9 per recommendation) records.
9. **Persist RecommendationRun**: Store `RecommendationRun` with `scoringWeightsVersionId`, snapshot tag `scoringWeightsVersion`, and `relaxationApplied`.

### 2.4 ApplicationScope Responsibilities & Boundaries
- **Wave 1 (Project Workspace)**: Accepts, validates, and persists `INTERIOR`, `EXTERIOR`, and `BOTH`, exposing them through project APIs. Wave 1 does NOT generate recommendations and does NOT test recommendation output for `BOTH`.
- **MVP Recommendation Engine (Plan 02-05)**: For `ApplicationScope.BOTH`, the MVP recommendation engine generates a single ranked list of exactly 5 recommendations matching products suitable for interior, exterior, or both.
- **Later-Phase Dual-List Generation**: Separate Interior and Exterior recommendation lists remain strictly deferred to Phase 3 (Wave 2) as defined by authoritative specifications.

---

## 3. Plan Decomposition Strategy

Phase 2 will be executed across 5 focused plans:
1. **Plan 02-01**: Auth UI, Consent Flow (`POST /api/v1/auth/consent`), and Project Workspace CRUD (Tasks 1.1 & 1.2).
2. **Plan 02-02**: Google Geocoding integration, interactive location confirmation UI, and Open-Meteo Climate Profiling Engine (Tasks 1.3 & 1.4).
3. **Plan 02-03**: Secure multipart image upload to Azure Blob Storage, upload rate limiting, and BullMQ Gemini Vision analysis worker (Tasks 1.5 & 1.6). Strict non-null `ImageAnalysisResult.projectImageId`.
4. **Plan 02-04**: Image Analysis Review UI (with `AI_INFERRED` vs `USER_OVERRIDDEN` state management), Scope Selector (`INTERIOR`/`EXTERIOR`/`BOTH`), and Verified Asian Paints Catalogue Ingestion (Tasks 1.7, 1.8 & 1.9).
5. **Plan 02-05**: 9-Factor Recommendation Scoring Engine (all 9 factors), Palette Harmony post-scoring diversity filtering, Natural Language Explanation generator, Google Places Dealer Discovery (`THIRD_PARTY_DISCOVERED`), and E2E Test Suite (Tasks 1.10, 1.11, 1.12 & 1.13).
