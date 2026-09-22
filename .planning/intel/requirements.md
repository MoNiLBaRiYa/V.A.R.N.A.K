# Synthesized Requirements

Synthesized from: `.kiro/specs/paint-platform/requirements.md`

---

## REQ-01: User Registration and Authentication
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-1-user-registration-and-authentication`
- **Scope**: Authentication, User Management, Identity
- **User Story**: As a new user, I want to register and log in securely, so that my projects and data are protected under my identity.
- **Acceptance Criteria**:
  1. Redirect user to Microsoft Entra External ID for identity creation, email verification, and credential management.
  2. Maintain zero separate password authentication systems independent of Entra External ID.
  3. Database stores only internal User ID, external identity provider subject identifier, email address, role, profile info, consent metadata, and audit event references.
  4. Record PrivacyPolicy version acceptance (`privacyPolicyVersion`, `privacyAcceptedAt`) in UserProfiles table.
  5. Display clear disclosure regarding external AI image processing (Gemini) and persist disclosure acceptance.
  6. Establish session using Auth.js v5 as OIDC integration layer.
  7. Apply account lockout / CAPTCHA per Entra External ID tenant policy.
  8. Write AuditLog entries for: registration, email verification, login, logout, failed login, password reset initiation, role change.
  9. Support social identity providers enabled in Entra tenant without local passwords.
  10. Password reset flow delegated entirely to Entra External ID without local reset endpoints.

## REQ-02: Project Management
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-2-project-management`
- **Scope**: Projects, Workspaces
- **User Story**: As a user, I want to create and manage named projects for each property I am evaluating, so that my work is organized and retrievable.
- **Acceptance Criteria**:
  1. Allow authenticated user to create a Project with a required name and optional description.
  2. Persist Project with owner reference, timestamps, and state (`ACTIVE` or `ARCHIVED`).
  3. Default project list view displays only `ACTIVE` projects.
  4. Provide separate archived-projects view.
  5. Archiving sets `archivedAt` timestamp and state to `ARCHIVED` without data loss.
  6. Unarchiving clears `archivedAt` and restores state to `ACTIVE`.
  7. Unauthorized access attempts return 403 Forbidden and log an audit entry.
  8. Update name and description of `ACTIVE` projects.

## REQ-03: Property Location Input and Geocoding
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-3-property-location-input-and-geocoding`
- **Scope**: Location, Geocoding
- **User Story**: As a user, I want to enter my property's location by address or PIN code, so that the Platform can derive its geographic coordinates for climate and dealer discovery.
- **Acceptance Criteria**:
  1. Accept property location as free-text address or postal/PIN code.
  2. Resolve input to latitude/longitude coordinates via configured GeocodingProvider.
  3. Support Google Geocoding API (primary) and Mappls Geocoding API (client abstractions).
  4. Fall back between configured providers and log fallback event in DataSource provenance record.
  5. If resolution fails, present descriptive error and halt climate retrieval.
  6. Persist resolved coordinates tagged with provider and provenance flags (`USER_PROVIDED` input, `DERIVED` coordinates).
  7. Display resolved address and coordinates to user for confirmation prior to persisting.
  8. Mappls marked deferred in documentation for v1; Google Geocoding remains operative primary.

## REQ-04: Climate Profile Retrieval
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-4-climate-profile-retrieval`
- **Scope**: Climate, Environmental Intelligence
- **User Story**: As a user, I want the Platform to automatically fetch a year-round climate profile for my property's location, so that paint recommendations account for the local environment.
- **Acceptance Criteria**:
  1. Automatically retrieve year-round climate summary (temperature ranges, humidity, rainfall, UV index, freeze-thaw cycles) using resolved coordinates.
  2. Integrate with Open-Meteo API as primary climate data provider.
  3. Cache climate data per coordinate grid/region to minimize redundant API calls.
  4. Fall back to regional aggregate cached climate datasets if live provider is unavailable.
  5. Store climate profile associated with Project with timestamp and provider attribution.

## REQ-05: Image Upload and Storage
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-5-image-upload`
- **Scope**: Media, Blob Storage
- **User Story**: As a user, I want to upload photos of my property, so that the Platform can analyze its architectural style and paintable surfaces.
- **Acceptance Criteria**:
  1. Accept image uploads (JPEG, PNG, WebP) up to 10MB per image.
  2. Validate file type and scan for malicious payloads before storage.
  3. Store uploaded images in Azure Blob Storage with unique identifiers.
  4. Maintain image processing lifecycle state: `UPLOADED` -> `QUEUED` -> `PROCESSING` -> `COMPLETED` | `FAILED`.
  5. Support multiple images per Project (interior and exterior).

## REQ-06: AI Image Analysis
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-6-ai-image-analysis`
- **Scope**: AI Vision, Gemini API
- **User Story**: As a user, I want the Platform to analyze my uploaded photos using AI vision, so that architectural details and surfaces are automatically detected.
- **Acceptance Criteria**:
  1. Dispatch uploaded images to Gemini Vision model for asynchronous analysis via BullMQ queue.
  2. Extract structured analysis: room type, architectural style, wall surface materials, natural lighting conditions, and paintable regions.
  3. Assign confidence scores and provenance label `AI_INFERRED` to each detected attribute.
  4. Handle processing timeouts, transient errors with exponential backoff retries, and dead-letter queues.
  5. Persist `ImageAnalysisResult` linked to the `ProjectImage`.

## REQ-07: Image Analysis Review and Correction
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-7-image-analysis-review-and-correction`
- **Scope**: UI, User Corrections
- **User Story**: As a user, I want to review and correct the AI-detected image analysis results, so that recommendations are based on accurate property details.
- **Acceptance Criteria**:
  1. Render an interactive review UI showing detected architectural features, surface types, and lighting.
  2. Allow user to confirm detected values (updating provenance to `USER_CONFIRMED`).
  3. Allow user to override or correct any attribute (updating provenance to `USER_OVERRIDDEN`).
  4. Persist overrides without overwriting the original raw AI inferences for auditability.

## REQ-08: Paint Manufacturer and Scope Selection
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-8-paint-manufacturer-and-scope-selection`
- **Scope**: Recommendations, Configuration
- **User Story**: As a user, I want to choose my preferred paint brand and application scope (interior/exterior), so that recommendations match my preferences.
- **Acceptance Criteria**:
  1. Support selection from four manufacturers: Asian Paints, Birla Opus, Nerolac, Berger Paints (Wave 1 MVP supports at least Asian Paints verified catalogue; Wave 2 enables all four).
  2. Support application scope selection: `INTERIOR`, `EXTERIOR`, or `BOTH`.
  3. Validate project image selection against chosen scope.

## REQ-09: Paint Recommendation Engine
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-9-paint-recommendation-engine`
- **Scope**: Recommendation Algorithm, Scoring
- **User Story**: As a user, I want to receive data-driven, ranked paint shade recommendations tailored to my climate and property.
- **Acceptance Criteria**:
  1. Calculate composite scores for candidate manufacturer shades across 9 weighted scoring factors.
  2. Candidate shades must strictly belong to official verified manufacturer catalogues with verified codes and names.
  3. Apply Palette Harmony algorithm to ensure diversity among the top 5 output recommendations.
  4. Return exactly 5 ranked recommendations with shade code, manufacturer, finish, composite score, and factor breakdown.
  5. Provide filter relaxation fallback if initial strict criteria yield fewer than 5 recommendations.

## REQ-10: Recommendation Explanation
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-10-recommendation-explanation`
- **Scope**: Recommendations, Explainability
- **User Story**: As a user, I want to understand why each paint shade was recommended, so that I can make an informed decision.
- **Acceptance Criteria**:
  1. Generate natural language explanations for each recommendation breaking down how climate, architectural style, and lighting influenced the score.
  2. Highlight the dominant positive factors and any trade-offs (e.g., high UV resistance in sunny exterior).
  3. Present transparent factor score cards alongside the explanation.

## REQ-11: Dealer Discovery (Wave 1)
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-11-basic-dealer-discovery-wave-1`
- **Scope**: Dealers, Maps, Geo-Search
- **User Story**: As a user, I want to locate nearby authorized paint dealers for the recommended brand, so that I can purchase the paint.
- **Acceptance Criteria**:
  1. Discover paint dealers within a configurable radius of property coordinates using Google Places API.
  2. Filter dealers by selected manufacturer brand.
  3. Display dealer name, address, contact details, distance, and verification state (`VERIFIED_OFFICIAL`, `THIRD_PARTY_DISCOVERED`, `UNVERIFIED`).

## REQ-12: Paint Shade Catalogue Integrity
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-12-paint-shade-catalogue-integrity`
- **Scope**: Catalogue, Data Provenance
- **User Story**: As an administrator, I want to ensure paint catalogue data comes only from verified manufacturer sources, so that recommendations never recommend non-existent shades.
- **Acceptance Criteria**:
  1. Maintain provenance records (`PaintShadeSources`) for every shade in the catalogue.
  2. Prevent manual creation of arbitrary shade codes without source attribution.
  3. Enforce catalogue review and approval workflows before shades become active in recommendation runs.

## REQ-13: Privacy and Data Handling
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-13-privacy-and-data-handling`
- **Scope**: Privacy, Compliance, GDPR/DSAR
- **User Story**: As a user, I want control over my personal data and uploaded photos, so that my privacy rights are respected.
- **Acceptance Criteria**:
  1. Record explicit consent for terms of service, privacy policy, and AI data processing.
  2. Provide self-service Data Subject Access Request (DSAR) export in structured format (JSON/ZIP).
  3. Provide self-service account and project deletion with complete purging of blobs and database records.

## REQ-14: Email Notifications
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-14-email-notifications`
- **Scope**: Notifications, Communication
- **User Story**: As a user, I want to receive email updates when long-running analysis or visualization jobs complete.
- **Acceptance Criteria**:
  1. Abstract email delivery behind an `EmailService` interface with configurable providers (SendGrid or Azure Communication Services).
  2. Send transactional emails for: account registration welcome, asynchronous job completion, and DSAR export ready.
  3. Respect user notification preferences and opt-outs.

## REQ-15: Rate Limiting
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-15-rate-limiting`
- **Scope**: Security, Reliability
- **User Story**: As a platform operator, I want to prevent abuse and manage API costs by rate limiting requests.
- **Acceptance Criteria**:
  1. Implement Redis-backed sliding window rate limiters across sensitive endpoints (auth callbacks, image uploads, AI analysis, geocoding).
  2. Return standard 429 Too Many Requests with `Retry-After` headers when limits are breached.
  3. Configure tiered limits for anonymous vs authenticated users.

## REQ-16: System Security
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-16-system-security`
- **Scope**: Security, Infrastructure
- **User Story**: As a platform operator, I want robust security controls across the application, so that data and services remain secure.
- **Acceptance Criteria**:
  1. Enforce HTTPS, strict CSP headers, CORS policies, and secure cookie attributes.
  2. Store all secrets and API keys in Azure Key Vault; never commit secrets to source code.
  3. Sanitize all user inputs and enforce authorization checks on every project and resource access.
  4. Maintain tamper-evident audit logging for security-relevant operations.

## REQ-17: Performance Targets
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-17-performance-targets`
- **Scope**: Performance, SLOs
- **User Story**: As a user, I want fast page loads and responsive interactions.
- **Acceptance Criteria**:
  1. Core Web Vitals: Largest Contentful Paint (LCP) < 2.5s, First Input Delay (FID) / INP < 200ms, Cumulative Layout Shift (CLS) < 0.1.
  2. Recommendation generation response time < 3.0s for cached climate/catalogue data.
  3. Asynchronous image processing completion notification within SLA.

## REQ-18: Audit Logging
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-18-audit-logging`
- **Scope**: Compliance, Audit
- **User Story**: As a compliance officer, I want a complete audit trail of critical events.
- **Acceptance Criteria**:
  1. Write structured audit logs to database and Application Insights for: authentication events, authorization violations, DSAR actions, account deletion, catalogue modifications, and scoring weight changes.
  2. Ensure audit logs are append-only and cannot be mutated or deleted by regular users.

## REQ-19: Visualization (Wave 3)
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-19-visualization-wave-3`
- **Scope**: Generative AI, Visualization
- **User Story**: As a user, I want to see a realistic preview of recommended paint colors applied to my home photos.
- **Acceptance Criteria**:
  1. Provide interactive source image selection for visualization.
  2. Dispatch asynchronous generation jobs to Gemini Image Generation (`GEMINI_IMAGE_MODEL`).
  3. Support curated fallback prompts and safety retry handling for model refusals.
  4. Store generated preview images in Azure Blob Storage and display them with side-by-side comparison UI.
  5. Include indicative preview watermarking and clear AI-generated disclosures.

## REQ-20: Multi-Image Aggregation (Wave 2)
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-20-multi-image-aggregation-wave-2`
- **Scope**: Advanced Recommendations, Aggregation
- **User Story**: As a user, I want recommendations to consider all photos of my home collectively, so that the overall home palette is coherent.
- **Acceptance Criteria**:
  1. Aggregate detected features across multiple interior or exterior images within a Project.
  2. Resolve conflicting attributes across angles using confidence-weighted voting.
  3. Generate cohesive multi-room or whole-house paint palettes for `BOTH` scope.

## REQ-21: Roles and Access Control
- **Source**: `.kiro/specs/paint-platform/requirements.md#requirement-21-roles-and-access-control`
- **Scope**: RBAC, Authorization
- **User Story**: As an administrator, I want role-based access control to protect administrative functions.
- **Acceptance Criteria**:
  1. Enforce RBAC with roles: `USER` and `ADMIN`.
  2. Restrict catalogue management, scoring weights configuration, and system audit views to `ADMIN`.
  3. Validate role claims on every protected API route and server action.
