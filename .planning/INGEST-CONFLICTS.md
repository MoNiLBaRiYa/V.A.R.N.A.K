## Conflict Detection Report

### RESOLVED CONFLICTS & WARNINGS (5)

[RESOLVED BLOCKER 1] ImageAnalysisResult.projectImageId schema definition vs Wave 2 synthesis
  Found: Design §4.6 defined `projectImageId String @unique` (non-null unique foreign key referencing ProjectImage), while Design §22 described project-level synthesis with `projectImageId = null`.
  Resolution: Created dedicated `ProjectAnalysisSynthesis` model (Design §4.24, Tasks §0.2.26, Tasks §2.4.2) linked 1:1 to `Project` (`projectId`). `ImageAnalysisResult.projectImageId String @unique` remains strictly 1:1 and non-null with `ProjectImage`.

[RESOLVED BLOCKER 2] ScoringWeights persistent model missing from Design §4 database schema
  Found: Requirements §9, §18, and Design §7.3 mandated persistent, versioned ScoringWeights with active status and audit logging, but Design §4 previously defined only 23 models without a ScoringWeights table.
  Resolution: Created dedicated `ScoringWeightVersion` model (Design §4.25, Tasks §0.2.27, Tasks §4.3.1) with unique version string, 9-factor JSON weights, `isActive` flag, and AuditLog event. `RecommendationRun` (§4.13) references `ScoringWeightVersion` via `scoringWeightsVersionId`. Total database models: exactly 25.

[RESOLVED WARNING 1] Project archive/unarchive HTTP method inconsistency
  Found: Design §6.1 specified `POST /api/v1/projects/:id/archive` (matched by Tasks §1.2.4), while Design §23.1 specified `PATCH /api/v1/projects/:id/archive`.
  Resolution: Standardized on `POST /api/v1/projects/:id/archive` and `POST /api/v1/projects/:id/unarchive` in Design §23.1, matching Design §6.1 and Tasks §1.2.4/§1.2.5.

[RESOLVED WARNING 2] DealerBrands.brandId lacks Prisma relation to PaintBrand
  Found: Design §4.17 defined `brandId String` on `DealerBrand` without an explicit Prisma `@relation` to `PaintBrand`.
  Resolution: Added explicit foreign key `@relation(fields: [brandId], references: [id])` on `DealerBrand` and back-relation `dealers DealerBrand[]` on `PaintBrand` (Design §4.7, §4.17; Tasks §0.2.19). Referential integrity is enforced in the initial schema migration.

[RESOLVED WARNING 3] Wave 1 unit test vs Wave 2 feature scope for ApplicationScope=BOTH
  Found: Tasks §1.8.4 required a Wave 1 unit test asserting `ApplicationScope=BOTH triggers two recommendation lists`, whereas Tasks §2.3 and Requirements designated dual-list generation as Wave 2 work.
  Resolution: Updated Requirements (Req 8.4, Req 9.12) and Tasks §1.8.4 to clarify that Wave 1 accepts, validates, and persists `INTERIOR`, `EXTERIOR`, and `BOTH`. Wave 2 implements and tests separate interior/exterior recommendation list generation (Tasks §2.3).

### ACTIVE BLOCKERS & WARNINGS
None. All detected conflicts and warnings are fully resolved across Requirements.md, Design.md, Tasks.md, and GSD planning artifacts.

### INFO (2)

[INFO] Geocoding provider alignment: Google Geocoding active, Mappls deferred
  Note: Requirements §3 and Design §12 both declare Google Geocoding API as the active primary geocoding provider, with Mappls Geocoding API explicitly deferred to a future release.

[INFO] Phased catalogue expansion across waves
  Note: Requirements §8, §12 and Design §2, §20 specify that Wave 1 MVP activates with verified Asian Paints catalogue shades, while Birla Opus, Nerolac, and Berger Paints catalogues are enabled in Wave 2.
