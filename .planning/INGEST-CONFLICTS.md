## Conflict Detection Report

### RESOLVED BLOCKERS (2)

[RESOLVED BLOCKER 1] ImageAnalysisResult.projectImageId schema definition vs Wave 2 synthesis
  Found: Design §4.6 defined `projectImageId String @unique` (non-null unique foreign key referencing ProjectImage), while Design §22 described project-level synthesis with `projectImageId = null`.
  Resolution: Created dedicated `ProjectAnalysisSynthesis` model (Design §4.24, Tasks §0.2.26, Tasks §2.4.2) linked 1:1 to `Project` (`projectId`). `ImageAnalysisResult.projectImageId String @unique` remains strictly 1:1 and non-null with `ProjectImage`.

[RESOLVED BLOCKER 2] ScoringWeights persistent model missing from Design §4 database schema
  Found: Requirements §9, §18, and Design §7.3 mandated persistent, versioned ScoringWeights with active status and audit logging, but Design §4 previously defined only 23 models without a ScoringWeights table.
  Resolution: Created dedicated `ScoringWeightVersion` model (Design §4.25, Tasks §0.2.27, Tasks §4.3.1) with unique version string, 9-factor JSON weights, `isActive` flag, and AuditLog event. `RecommendationRun` (§4.13) references `ScoringWeightVersion` via `scoringWeightsVersionId`. Total database models: exactly 25.

### ACTIVE WARNINGS (3 — Flagged, Non-Blocking)

[WARNING] Project archive/unarchive HTTP method inconsistency
  Found: Design §6.1 specifies `POST /api/v1/projects/:id/archive` (matched by Tasks §1.2.4)
  Impact: Design §23.1 specifies `PATCH /api/v1/projects/:id/archive`
  → Standardize on `POST` per Design §6.1 and Tasks §1.2.4 or update API route specifications in Design §23.1.

[WARNING] DealerBrands.brandId lacks Prisma relation to PaintBrand
  Found: Design §4.17 defines `brandId String` on DealerBrand without `@relation(fields: [brandId], references: [id])` to PaintBrand
  Impact: Database will not enforce foreign key referential integrity between DealerBrand and PaintBrand
  → Add relation fields on DealerBrand and PaintBrand in Design §4.17 if referential integrity is desired.

[WARNING] Wave 1 unit test vs Wave 2 feature scope for ApplicationScope=BOTH
  Found: Tasks §1.8.4 requires a Wave 1 unit test asserting `ApplicationScope=BOTH triggers two recommendation lists`
  Impact: Tasks §2.3 and Requirements explicitly designate the dual recommendation list implementation for BOTH scope as Wave 2 work
  → Clarify that Wave 1 validates and stores `ApplicationScope=BOTH`, while the dual-list generation algorithm is implemented in Wave 2.

### INFO (2)

[INFO] Geocoding provider alignment: Google Geocoding active, Mappls deferred
  Note: Requirements §3 and Design §12 both declare Google Geocoding API as the active primary geocoding provider, with Mappls Geocoding API explicitly deferred to a future release.

[INFO] Phased catalogue expansion across waves
  Note: Requirements §8, §12 and Design §2, §20 specify that Wave 1 MVP activates with verified Asian Paints catalogue shades, while Birla Opus, Nerolac, and Berger Paints catalogues are enabled in Wave 2.
