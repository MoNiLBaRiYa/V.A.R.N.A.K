# Phase 2 Plan 02-05 Summary: Recommendation Engine, Dealer Discovery & E2E Slice

## Status: COMPLETE
- **Phase**: 02-mvp-core
- **Plan**: 02-05
- **Wave**: 4
- **Completed**: 2026-10-13

---

## Deliverables & Architecture Implemented

### 1. 9-Factor Scoring Engine & Execution Sequence (`REQ-08`, `REQ-09`, `REQ-10`, `REQ-16`, `REQ-18`)
- `src/lib/recommendations/factors.ts`:
  - Exactly 9 normalized scoring functions returning floats in $[0.0, 1.0]$:
    1. `CLIMATE_SUITABILITY`: Weather resilience, UV degradation, and precipitation protection.
    2. `INTERIOR_EXTERIOR_COMPATIBILITY`: Scope match against product application scope.
    3. `SURFACE_COMPATIBILITY`: Overlap ratio between product-approved surfaces and detected surfaces.
    4. `PRODUCT_SUITABILITY`: Space utility alignment (e.g. washable emulsions for high-traffic zones).
    5. `ARCHITECTURAL_CHARACTERISTICS`: Synergy between shade colour family and architectural style.
    6. `ROOM_TYPE`: Finish suitability (matt for bedrooms, sheen for wet/utility areas).
    7. `NATURAL_LIGHT`: Reflectance tuning (light bounce in low-light, saturation in direct sunlight).
    8. `COLOUR_FAMILY_COMPATIBILITY`: Unambiguously implemented as factor 8 in MVP.
    9. `USER_PREFERENCES`: Evaluates to neutral baseline score of $0.5$ when preferences are unconfigured (§REQ-09).
  - Uses `ScoringWeightVersion` (`v1.0.0`) with weights strictly summing to $1.00$.
- `src/lib/recommendations/harmony.ts`:
  - `applyPaletteHarmony`: Pure deterministic post-scoring rule applied after composite scoring.
  - Replaces position 5 when $\ge 4$ of the top 5 candidates share the same colour family, sourcing an alternative family from positions 6–15 (inclusive).
  - Does NOT alter factor scores or composite scores.
- `src/lib/recommendations/relaxation.ts`:
  - Filter relaxation sequence executed in exact required order:
    1. `COLOUR_FAMILY_COMPATIBILITY`
    2. `NATURAL_LIGHT`
    3. `ROOM_TYPE`
    4. `ARCHITECTURAL_CHARACTERISTICS`
  - Halts at the first step that yields $\ge 5$ eligible candidates and captures step history in `relaxationApplied`.
- `src/lib/recommendations/explanation.ts`:
  - Deterministic natural language explanation generator detailing climate suitability, surface adhesion, and architectural harmony.
- `src/lib/recommendations/engine.ts`:
  - Implements the strict 9-step execution sequence:
    1. Load active verified shades for Asian Paints.
    2. Apply mandatory compatibility filters.
    3. Compute all 9 factor scores.
    4. Compute composite score: $\sum (factorScore_i \times weight_i)$.
    5. Sort deterministically (`compositeScore DESC`, `shadeId ASC`).
    6. Apply Palette Harmony post-scoring diversity rule.
    7. Apply Filter Relaxation sequence if $< 5$ candidates qualify.
    8. Persist top 5 `Recommendation` and 45 `RecommendationFactor` rows in Azure SQL.
    9. Persist `RecommendationRun` record with snapshot of `scoringWeightsVersion`.
  - For `ApplicationScope.BOTH`: Generates a single ranked list of exactly 5 recommendations in MVP per authoritative specification (separate dual-list generation is strictly deferred to Phase 3).
- Endpoints:
  - `POST /api/v1/projects/[id]/recommendations`: Rejects archived projects with 409, halts with 422 if climate profile is missing, enforces rate limit of 10 runs/day, and returns top 5 recommendations.
  - `GET /api/v1/projects/[id]/recommendations/[runId]`: Returns full run details, factor scores, and explanations.

### 2. Dealer Discovery & Results UI (`REQ-11`, `REQ-12`, `REQ-15`)
- `src/lib/dealers/discovery-service.ts`:
  - Queries Google Places API for nearby Asian Paints retailers.
  - Persists records into `Dealer` and `DealerBrand` models strictly with `state: THIRD_PARTY_DISCOVERED` (`isClaimed: false`, `isAuthorized: false`). Never auto-assigns `VERIFIED_OFFICIAL`.
- Endpoints & Components:
  - `GET /api/v1/dealers`: Returns nearby dealers sorted by distance.
  - `src/components/recommendations/RecommendationResults.tsx`: Displays top 5 recommendations with hex swatches, rank badges, finish types, composite scores, 9-factor diagnostic breakdown, explanation text, and Palette Harmony badge.
  - `src/components/dealers/DealerList.tsx`: Displays nearby dealer cards with distances and "Third-Party Discovered" badges.

### 3. Comprehensive End-to-End Vertical Slice (`REQ-13`, `REQ-16`)
- `tests/e2e/vertical-slice.test.ts`:
  - Verifies complete customer journey: Authentication → Dual-Consent → Project Creation → Geocoding & Confirmation → Climate Profile Fetch → Photo Ingestion → Gemini Vision Analysis → Review with User Overrides → Scope Selection (`BOTH` generates single 5-shade list) → 9-Factor Scoring → Palette Harmony Diversity → Dealer Discovery.
  - Strict Boundary Check: Asserts zero references to Wave 3 generative visualization entities (`ImageGenerationJob`, `visualization-queue`, `GeminiFallbackPrompt`).

---

## Verification & Test Results
- **Unit, Property & Integration Tests**:
  - `tests/recommendations/scoring.test.ts`: 6/6 tests passing.
  - `tests/recommendations/harmony.test.ts`: 4/4 tests passing.
  - `tests/recommendations/relaxation.test.ts`: 3/3 tests passing.
  - `tests/dealers/discovery.test.ts`: 1/1 test passing.
  - `tests/e2e/vertical-slice.test.ts`: 2/2 tests passing.
  - Full test suite: **81/81 tests passing** across 18 test files.
- **Type Checking & Production Build**:
  - `tsc --noEmit`: 0 errors.
  - `next build`: Successfully compiled all static and dynamic routes.
