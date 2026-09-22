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

## CON-02: Database Schema & Entity Relationships
- **Source**: `.kiro/specs/paint-platform/design.md#4-database-schema`
- **Type**: `schema`
- **Constraint Block**:
  - Prisma 5 with Microsoft SQL Server provider (`@prisma/client`).
  - Core entities: `Users`, `UserProfiles`, `Projects`, `ProjectLocations`, `ProjectImages`, `ImageAnalysisResults`, `PaintShades`, `PaintProducts`, `PaintShadeSources`, `ScoringWeights`, `RecommendationRuns`, `Recommendations`, `RecommendationFactors`, `Dealers`, `ImageGenerationJobs`, `GeneratedImages`, `AuditLogs`.
  - Foreign keys must enforce referential integrity with appropriate cascading rules.
  - Lifecycle enums: `ImageProcessingState` (`UPLOADED`, `QUEUED`, `PROCESSING`, `RETRYING`, `COMPLETED`, `FAILED`, `DELETED`), `AnalysisState` (`AI_INFERRED`, `USER_CONFIRMED`, `USER_OVERRIDDEN`), `DealerState` (`VERIFIED_OFFICIAL`, `THIRD_PARTY_DISCOVERED`, `UNVERIFIED`).

## CON-03: Media Storage & Access Control
- **Source**: `.kiro/specs/paint-platform/design.md#2-technology-stack`, `#16-security-design`
- **Type**: `api-contract`
- **Constraint Block**:
  - Images must be stored in Azure Blob Storage with private container access.
  - Direct public access to storage containers is forbidden.
  - Client uploads must use pre-signed time-limited SAS URLs generated server-side.
  - Previews must be served via authenticated API route streaming or short-lived read SAS URLs.

## CON-04: Asynchronous Processing & Queue Contracts
- **Source**: `.kiro/specs/paint-platform/design.md#10-image-analysis-pipeline`, `#13-visualization-pipeline-wave-3`
- **Type**: `protocol`
- **Constraint Block**:
  - Job queues managed via BullMQ backed by Azure Cache for Redis.
  - Queues: `image-analysis-queue` and `image-visualization-queue`.
  - Retry policy: maximum 3 attempts with exponential backoff (`initialDelay: 2000ms`, `backoffFactor: 2`).
  - Failed jobs after 3 attempts must transition to dead-letter queue and update database record to `FAILED`.

## CON-05: AI Service Integration Contracts
- **Source**: `.kiro/specs/paint-platform/design.md#10-image-analysis-pipeline`, `#13-visualization-pipeline-wave-3`
- **Type**: `api-contract`
- **Constraint Block**:
  - Vision Model: Gemini Vision API accessed via official Google GenAI SDK.
  - Analysis must output JSON conforming strictly to `ImageAnalysisResult` schema.
  - Visualization Model: Gemini Image Generation (`GEMINI_IMAGE_MODEL`) in Wave 3.
  - Safety refusal handling: on safety refusal, system must attempt fallback prompt with generic neutral descriptors before reporting failure.

## CON-06: Recommendation Engine Scoring & Harmony
- **Source**: `.kiro/specs/paint-platform/design.md#7-recommendation-engine-design`, `#8-palette-harmony-algorithm`
- **Type**: `algorithm`
- **Constraint Block**:
  - Composite score calculated as weighted sum of 9 factors:
    1. Climate-Surface Durability ($w_1$)
    2. UV Resistance & Sunlight Exposure ($w_2$)
    3. Moisture & Humidity Resilience ($w_3$)
    4. Architectural Style Compatibility ($w_4$)
    5. Natural Lighting & Orientation ($w_5$)
    6. Regional Aesthetic Context ($w_6$)
    7. User Preference Alignment ($w_7$)
    8. Manufacturer Finish / Sheen Suitability ($w_8$)
    9. Undertone & Base Harmony ($w_9$)
  - Palette Harmony Rule: No single color family may occupy more than 2 of the final 5 recommendations unless user explicitly requested a monochromatic scheme.
  - Filter Relaxation: If strict filtering yields < 5 recommendations, relax factors in predefined sequence: (1) undertone harmony, (2) regional aesthetic, (3) architectural style tolerance. Never relax climate durability or manufacturer brand selection.

## CON-07: External API Dependencies & Fallbacks
- **Source**: `.kiro/specs/paint-platform/design.md#11-climate-service-design`, `#12-geocoding-service-design`, `#14-dealer-discovery-and-verification`
- **Type**: `api-contract`
- **Constraint Block**:
  - Geocoding: Google Geocoding API (primary). Mappls Geocoding API deferred.
  - Climate: Open-Meteo API (primary) with regional aggregate cached datasets as fallback.
  - Dealer Discovery: Google Places API (primary in Wave 1). Manufacturer dealer locator API integrated in Wave 3.
  - Email: `EmailService` interface with SendGrid or Azure Communication Services.

## CON-08: Non-Functional Requirements & Performance SLOs
- **Source**: `.kiro/specs/paint-platform/design.md#21-performance-targets`
- **Type**: `nfr`
- **Constraint Block**:
  - Core Web Vitals: LCP < 2.5s, FID/INP < 200ms, CLS < 0.1.
  - Recommendation Generation API: < 3.0 seconds (with cached climate & catalogue).
  - Rate Limiting: Redis sliding window with 429 response and `Retry-After`.
  - Accessibility: WCAG 2.1 AA compliance across all public and user-facing views.
  - Security: TLS 1.3, CSP without unsafe-inline, OWASP Top 10 mitigation.
