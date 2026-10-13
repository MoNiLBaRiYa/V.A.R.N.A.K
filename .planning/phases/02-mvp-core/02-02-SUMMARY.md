# Phase 2 Plan 02-02 Summary: Geocoding & Climate Profiling Engine

## Status: COMPLETE
- **Phase**: 02-mvp-core
- **Plan**: 02-02
- **Wave**: 2
- **Completed**: 2026-10-13

---

## Deliverables & Architecture Implemented

### 1. Google Geocoding Service & Confirmation Workflow (`REQ-03`, `REQ-16`)
- `src/lib/location/google-geocoding.ts`:
  - `GoogleGeocodingClient` querying Google Geocoding API with API key and country bias (`components=country:IN`).
  - Strict input validation and structured error taxonomy (`GeocodingError`).
- `src/lib/location/service.ts`:
  - `GeocodingService` providing two-step confirmation boundary:
    - Step 1: `resolveLocation` parses and resolves coordinates without persisting to database.
    - Step 2: `confirmLocation` stores `ProjectLocation` with `inputProvenance = USER_PROVIDED` and `coordinatesProvenance = VERIFIED`, logs audit event `LOCATION_CONFIRMED`, and triggers climate profiling.
    - Explicitly documents `MapplsGeocodingClient` stub (`isActive: false`) per Req 3.8.
- Endpoints & Components:
  - `POST /api/v1/projects/[id]/location`: Stateless preview endpoint.
  - `POST /api/v1/projects/[id]/location/confirm`: Persisting endpoint.
  - `src/components/location/LocationConfirmationCard.tsx`: Client-side UI with search preview, address verification, and confirmation action.

### 2. Open-Meteo Climate Service & Regional Fallback Engine (`REQ-04`, `REQ-18`)
- `src/data/regional-climate.json`:
  - Bundled 5-zone Indian climatology (Hot & Dry, Warm & Humid, Composite, Temperate, Cold) with 12 monthly observation points for temperature, humidity, precipitation, UV index, and wind speed.
- `src/lib/climate/open-meteo.ts`:
  - `OpenMeteoClient` retrieving full-year daily records from Open-Meteo Archive API and computing 12 monthly aggregates with exponential backoff retries.
- `src/lib/climate/regional-fallback.ts`:
  - `RegionalAggregateClient` computing Euclidean distance to nearest zone centroid when Open-Meteo primary service is unavailable.
- `src/lib/climate/service.ts`:
  - `ClimateService.fetchAndPersistProfile` orchestrating primary Open-Meteo fetch with graceful regional fallback.
  - Correctly tags `provenance = VERIVED` for Open-Meteo and `provenance = DERIVED` for fallback.
  - Persists `ClimateProfile` with exactly 12 `ClimateObservation` rows in Azure SQL.
  - Throws `ClimateUnavailableException` if both sources fail, which halts recommendation runs with HTTP 422.
- Endpoints & Components:
  - `GET /api/v1/projects/[id]/climate`: Returns `ClimateProfile` with observations. If `provenance == 'DERIVED'`, attaches `climateDataNote: "Regional average climate data was used. Local conditions may vary."`.
  - `src/components/climate/ClimateDisplayCard.tsx`: Visual climate metrics dashboard with monthly trends and prominent derived provenance notification.

---

## Verification & Test Results
- **Unit & Integration Tests**:
  - `tests/location/geocoding.test.ts`: 6/6 tests passing (two-step boundary, input validation, audit logging, error states).
  - `tests/climate/climate.test.ts`: 7/7 tests passing (primary fetch, regional fallback, exactly 12 observations, `climateDataNote` assertion, missing climate 422 behavior).
  - Full test suite: **43/43 tests passing** across 9 test files.
- **Type Checking & Production Build**:
  - `tsc --noEmit`: 0 errors.
  - `next build`: Successfully compiled all 10 static and dynamic routes.
