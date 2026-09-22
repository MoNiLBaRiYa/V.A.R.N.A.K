## Conflict Detection Report

### BLOCKERS (2)

[BLOCKER] ImageAnalysisResult.projectImageId schema definition vs Wave 2 synthesis
  Found: Design §4.6 defines `projectImageId String @unique` (non-null unique foreign key referencing ProjectImage)
  Expected: Design §22 requires project-level synthesis stored as an ImageAnalysisResult with `projectImageId = null`
  → Resolve in Design.md by either making `projectImageId String?` with filtered unique index, or explicitly defining a separate ProjectAnalysisSynthesis model before running database migrations.

[BLOCKER] ScoringWeights persistent model missing from Design §4 database schema
  Found: Design §4 defines exactly 23 database models and does not include a ScoringWeights model; RecommendationRun (§4.13) only stores `scoringWeightsVersion String`
  Expected: Requirements §9, §18, and Design §7.3 mandate persistent, versioned ScoringWeights with active status and audit logging of weight changes
  → Clarify in Design §4 whether ScoringWeights is stored as a 24th database table (`ScoringWeights`), in a JSON configuration file, or in application code before finalizing database schema.

### WARNINGS (3)

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
