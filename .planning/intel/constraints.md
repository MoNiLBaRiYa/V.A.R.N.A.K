# Technical Constraints & Architectural Contracts

Synthesized from: `.kiro/specs/paint-platform/design.md`

---

## CON-01: Authentication & Identity Authority Contract
- **Source**: `.kiro/specs/paint-platform/design.md#3-authentication-architecture`
- **Type**: `protocol` / `security`
- **Constraint Block**:
  - Microsoft Entra External ID is the sole authority. The platform MUST NOT store password hashes or expose local auth endpoints.
  - Auth.js v5 acts purely as an OIDC client and session layer.
  - Cookies must be `HttpOnly`, `Secure`, `SameSite=Lax`.
  - Registration must capture explicit acceptance of Privacy Policy version and AI image processing disclosure.

## CON-02: Database Schema & Entity Relationships (25 Models)
- **Source**: `.kiro/specs/paint-platform/design.md#4-database-schema`
- **Type**: `schema`
- **Constraint Block**:
  - Prisma 5 with Microsoft SQL Server provider (`@prisma/client`).
  - Exactly 25 models defined in Design §4:
    1. `Users` (§4.1)
    2. `UserProfiles` (§4.2)
    3. `Projects` (§4.3)
    4. `ProjectLocations` (§4.4)
    5. `ProjectImages` (§4.5)
    6. `ImageAnalysisResults` (§4.6)
    7. `PaintBrands` (§4.7, with `dealers DealerBrand[]` back-relation)
    8. `PaintProducts` (§4.8)
    9. `PaintShades` (§4.9)
    10. `PaintShadeSources` (§4.10)
    11. `ClimateProfiles` (§4.11)
    12. `ClimateObservations` (§4.12)
    13. `RecommendationRuns` (§4.13)
    14. `Recommendations` (§4.14)
    15. `RecommendationFactors` (§4.15)
    16. `Dealers` (§4.16)
    17. `DealerBrands` (§4.17, with `brand PaintBrand @relation` foreign key)
    18. `DealerVerificationRecords` (§4.18)
    19. `ImageGenerationJobs` (§4.19, Wave 3 schema entity)
    20. `GeneratedImages` (§4.20, Wave 3 schema entity)
    21. `GeminiFallbackPrompts` (§4.21, Wave 3 schema entity)
    22. `DataSources` (§4.22)
    23. `AuditLogs` (§4.23)
    24. `ProjectAnalysisSynthesis` (§4.24, Wave 2 multi-image synthesis entity)
    25. `ScoringWeightVersion` (§4.25, persistent scoring weights version entity)
  - Enums defined: `UserRole`, `ProjectStatus`, `ImageProcessingState`, `AnalysisState`, `ApplicationScope`, `Provenance`, `RunStatus`, `ScoringFactor`, `DealerState`, `GenerationJobStatus`.
  - Resolved Schema & Architecture Items:
    - **ImageAnalysisResult.projectImageId**: Preserved as strict 1:1 `String @unique` with `ProjectImage`. Multi-image whole-home synthesis is handled via dedicated `ProjectAnalysisSynthesis` model (§4.24).
    - **ScoringWeights Persistence**: Modeled via dedicated relational `ScoringWeightVersion` table (§4.25) referenced by `RecommendationRun.scoringWeightsVersionId`.
    - **DealerBrands.brandId Relation**: Explicit `@relation(fields: [brandId], references: [id])` to `PaintBrand` and back-relation on `PaintBrand` added to Prisma schema (Design §4.7, §4.17; Tasks §0.2.19).
    - **Project Archive HTTP Method**: Standardized on `POST /api/v1/projects/:id/archive` and `POST /api/v1/projects/:id/unarchive` across Design §6.1, Tasks §1.2.4/§1.2.5, and Design §23.1.
    - **ApplicationScope=BOTH Scope**: Wave 1 accepts, validates, and persists `INTERIOR`, `EXTERIOR`, and `BOTH`. Wave 2 implements and tests dual recommendation lists (Requirements Req 8.4, 9.12; Tasks §1.8.4, §2.3).

## CON-03: Media Storage & Access Control
- **Source**: `.kiro/specs/paint-platform/design.md#2-technology-stack`, `#16-security-design`
- **Type**: `api-contract`
- **Constraint Block**:
  - Images must be stored in Azure Blob Storage private containers (`project-images`, `generated-images`).
  - Direct public access to storage containers is forbidden.
  - Client uploads must use pre-signed time-limited SAS URLs generated server-side.
  - Previews must be served via authenticated API route streaming or short-lived read SAS URLs.

## CON-04: Asynchronous Processing & Queue Contracts
- **Source**: `.kiro/specs/paint-platform/design.md#2-technology-stack`, `.kiro/specs/paint-platform/tasks.md#04-redis-and-queue-setup`
- **Type**: `protocol`
- **Constraint Block**:
  - Job queues managed via BullMQ backed by Azure Cache for Redis.
  - Wave 0 / Foundation Queues: `image-analysis-queue` and `recommendation-queue` with worker entrypoint `analysis-worker.ts`.
  - Wave 3 Queue: `visualization-queue` with `visualization-worker.ts` is deferred to Wave 3.
  - Retry policy: maximum 3 attempts with exponential backoff (`initialDelay: 2000ms`, `backoffFactor: 2`).
  - Failed jobs after 3 attempts must transition to dead-letter handling and update database record to `FAILED`.

## CON-05: AI Service Integration Contracts
- **Source**: `.kiro/specs/paint-platform/design.md#10-image-analysis-pipeline`, `#13-visualization-pipeline-wave-3`
- **Type**: `api-contract`
- **Constraint Block**:
  - Vision Model: Gemini Vision API accessed via official Google GenAI SDK (Wave 1).
  - Analysis must output JSON conforming strictly to `ImageAnalysisResult` attributes.
  - Visualization Model: Gemini Image Generation (`GEMINI_IMAGE_MODEL`) in Wave 3.
  - Safety refusal handling: on safety refusal, system must attempt fallback prompt with generic neutral descriptors before reporting failure.

## CON-06: Recommendation Engine Scoring & Harmony
- **Source**: `.kiro/specs/paint-platform/design.md#7-recommendation-engine-design`, `#8-palette-harmony-algorithm`
- **Type**: `algorithm`
- **Constraint Block**:
  - Composite score calculated as weighted sum of exactly 9 factors (`ScoringFactor` enum):
    1. Climate suitability (`CLIMATE_SUITABILITY`)
    2. Interior/exterior compatibility (`INTERIOR_EXTERIOR_COMPATIBILITY`)
    3. Surface compatibility (`SURFACE_COMPATIBILITY`)
    4. Product suitability (`PRODUCT_SUITABILITY`)
    5. Architectural characteristics (`ARCHITECTURAL_CHARACTERISTICS`)
    6. Room type (`ROOM_TYPE`)
    7. Natural light (`NATURAL_LIGHT`)
    8. Colour family compatibility (`COLOUR_FAMILY_COMPATIBILITY`)
    9. User preferences (`USER_PREFERENCES`)
  - Palette Harmony Rule: Deterministic post-scoring selection rule, NOT a tenth scoring factor. Prevents excessive monochromatic concentration in top 5 outputs.
  - Filter Relaxation: If strict filtering yields < 5 recommendations, relax factors in predefined sequence: (1) undertone harmony, (2) regional aesthetic, (3) architectural style tolerance. Never relax climate durability or manufacturer brand selection.

## CON-07: External API Dependencies & Fallbacks
- **Source**: `.kiro/specs/paint-platform/design.md#11-climate-service-design`, `#12-geocoding-service-design`, `#14-dealer-discovery-and-verification`
- **Type**: `api-contract`
- **Constraint Block**:
  - Geocoding: Google Geocoding API (primary in Wave 1). Mappls Geocoding API deferred.
  - Climate: Open-Meteo API (primary) with regional aggregate cached datasets as fallback.
  - Dealer Discovery: Google Places API (primary in Wave 1, discovered dealers tagged `THIRD_PARTY_DISCOVERED`). Manufacturer dealer locator API integrated in Wave 3 for `VERIFIED_OFFICIAL`.
  - Email: `EmailService` interface with SendGrid or Azure Communication Services adapters.

## CON-08: Non-Functional Requirements & Performance SLOs
- **Source**: `.kiro/specs/paint-platform/design.md#21-performance-targets`
- **Type**: `nfr`
- **Constraint Block**:
  - Core Web Vitals: LCP < 2.5s, FID/INP < 200ms, CLS < 0.1.
  - Recommendation Generation API: < 3.0 seconds (with cached climate & catalogue).
  - Rate Limiting: Redis sliding window with 429 response and `Retry-After`.
  - Accessibility: WCAG 2.1 AA compliance across all public and user-facing views.
  - Security: TLS 1.3, CSP without unsafe-inline, OWASP Top 10 mitigation.
