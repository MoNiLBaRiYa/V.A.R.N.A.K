# Requirements Document

## Introduction

The Climate-Aware Home Paint Recommendation & Visualization Platform (hereafter "the Platform") is a web application that allows homeowners to receive data-driven, manufacturer-specific paint recommendations tailored to their property's geographic climate profile, architectural features, surface characteristics, and personal preferences. Users enter a property location, select one of four supported paint manufacturers, choose an application scope (Interior, Exterior, or Both), upload photographs of their home or rooms, and optionally supply supplementary property details. The Platform retrieves a year-round climate profile for the property coordinates, analyzes uploaded photographs using AI vision capabilities, and generates five ranked paint recommendations using only verified manufacturer shade names and shade codes. A subsequent visualization capability (Wave 3) allows users to preview recommended colours applied to their uploaded photographs.

The Platform is organized into six delivery waves:
- **Wave 0 — Foundation**: Infrastructure, database, authentication, email, secrets, logging, rate limiting, CI/CD, observability.
- **Wave 1 — MVP**: Authentication, project management, location/geocoding, climate retrieval, image upload, AI image analysis, analysis review UI, recommendation engine, recommendation explanation, basic dealer discovery, MVP manufacturer catalogue.
- **Wave 2 — Recommendation Depth**: Remaining manufacturers, user preferences, palette harmony, multi-image aggregation, BOTH scope, advanced segmentation.
- **Wave 3 — Visualization**: Source image selection, Gemini-based visualization generation, job processing, generated-image storage, retry/failure handling, fallback prompts, indicative previews, visualization UI, advanced dealer verification.
- **Wave 4 — Operations/Compliance**: DSAR, data export, account deletion, catalogue administration, scoring administration, audit, reporting, PDF export, security regression.
- **Wave 5 — Production Hardening**: Performance optimization, accessibility, security hardening, backup/restore, monitoring, production acceptance.

---

## Glossary

- **Platform**: The Climate-Aware Home Paint Recommendation & Visualization Platform described in this document.
- **User**: An authenticated homeowner or property manager using the Platform.
- **Project**: A named workspace that groups a property location, uploaded images, climate data, analysis results, and paint recommendations for a single property.
- **ProjectImage**: A photograph uploaded to a Project by a User.
- **ImageAnalysisResult**: The structured output of AI-based analysis of a single ProjectImage, including detected surfaces, room type, architectural features, natural light, and paintable regions.
- **ClimateProfile**: The structured year-round climate summary derived from a property's geographic coordinates, including temperature ranges, humidity, rainfall, UV index, wind, and freeze-thaw cycles.
- **ClimateObservation**: A discrete climate data point (temperature, humidity, UV, rainfall, etc.) associated with a location and time period.
- **Manufacturer**: One of four supported paint manufacturers: Asian Paints, Birla Opus, Nerolac, Berger Paints.
- **PaintShade**: A verified paint shade record comprising a manufacturer-canonical shade name and shade code as sourced from the manufacturer's official catalogue.
- **PaintShadeSources**: The provenance record for a PaintShade, capturing the data source, retrieval timestamp, and data-source URL or identifier.
- **PaintProduct**: A specific paint product within a Manufacturer's catalogue, associated with a formulation, finish type, and surface compatibility.
- **RecommendationRun**: A single execution of the recommendation engine for a Project, capturing inputs, scoring weights version, and output.
- **Recommendation**: A single ranked paint shade output from a RecommendationRun, containing the shade, all nine factor scores, composite score, and explanation.
- **RecommendationFactor**: The individual score record for one of the nine weighted scoring factors applied to a Recommendation.
- **ScoringWeights**: A versioned, configurable set of nine numerical weights applied to the nine scoring factors, persisted in the ScoringWeightVersion relational table.
- **PaletteHarmony**: A deterministic post-scoring selection rule (not a weighted scoring factor) that prevents excessive colour-family concentration among the five final recommendations.
- **ProjectAnalysisSynthesis**: A project-level relational record aggregating multi-image analysis findings for a Project, supporting conflict resolution and synthesized architectural insights without mutating the strict 1:1 image analysis relationship.
- **Geocoding**: The process of converting a textual address or PIN code to geographic coordinates (latitude/longitude).
- **GeocodingProvider**: A geocoding service provider (Google Geocoding API or Mappls Geocoding API).
- **Dealer**: A paint retailer or dealer associated with one or more Manufacturers.
- **DealerState**: The verification status of a Dealer: VERIFIED_OFFICIAL, THIRD_PARTY_DISCOVERED, or UNVERIFIED.
- **ImageGenerationJob**: A queued job that orchestrates Gemini-based paint visualization for a selected ProjectImage.
- **GeneratedImage**: An output image produced by an ImageGenerationJob, showing a ProjectImage with recommended paint colours applied.
- **GeminiFallbackPrompt**: A stored fallback prompt used when the primary Gemini visualization prompt is refused for safety or fails permanently.
- **DataSource**: A catalogue record describing an external data source (climate API, manufacturer catalogue, geocoding provider) including provenance, reliability, and last-updated timestamp.
- **AuditLog**: A tamper-evident record of security- and compliance-relevant events (login, role change, data export, etc.).
- **EmailService**: The Platform's internal abstraction for sending transactional email via a configured EmailProvider.
- **EmailProvider**: A concrete email delivery backend (e.g., SendGrid, Azure Communication Services) configured via environment variables.
- **PrivacyPolicyAcceptance**: The record of a User's explicit acceptance of a specific version of the Privacy Policy at a specific timestamp.
- **AnalysisState**: A provenance value of an ImageAnalysisResult field: AI_INFERRED, USER_CONFIRMED, or USER_OVERRIDDEN.
- **ImageProcessingState**: The lifecycle state of a ProjectImage: UPLOADED → QUEUED → PROCESSING → RETRYING → COMPLETED | FAILED | DELETED.
- **ProvenanceEnum**: A normalized provenance label applied to data records: VERIFIED, DERIVED, USER_PROVIDED, AI_INFERRED, AI_GENERATED, USER_CONFIRMED.
- **ApplicationScope**: The user's selection of paint application context: INTERIOR, EXTERIOR, or BOTH.
- **AUTH_PROVIDER**: Microsoft Entra External ID — the sole identity authority for the Platform.
- **Auth.js**: The application-layer OIDC/session integration library. Auth.js is NOT a second identity provider.
- **DSAR**: Data Subject Access Request under applicable privacy regulation.
- **SAM2**: Segment Anything Model 2 — an optional advanced image segmentation model used in Wave 2.
- **LCP**: Largest Contentful Paint — a Core Web Vitals metric.
- **MVP Manufacturer Catalogue**: The subset of the full paint shade catalogue populated for Wave 1, comprising at minimum one Manufacturer's verified shades.

---

## Requirements

---

### Requirement 1: User Registration and Authentication

**User Story:** As a new user, I want to register and log in securely, so that my projects and data are protected under my identity.

#### Acceptance Criteria

1. WHEN a new user initiates registration, THE Platform SHALL redirect the user to Microsoft Entra External ID for identity creation, email verification, and credential management.
2. THE Platform SHALL NOT maintain a separate password authentication system independent of Microsoft Entra External ID.
3. THE Platform database SHALL store only the internal User ID, external identity provider subject identifier, email address, role, profile information, consent metadata, and audit event references — and SHALL NOT store plaintext passwords.
4. WHEN a user completes Entra External ID registration, THE Platform SHALL record the user's acceptance of a specific PrivacyPolicy version, storing privacyPolicyVersion and privacyAcceptedAt in the UserProfiles table.
5. WHEN a user completes registration, THE Platform SHALL display a clear disclosure that uploaded photographs may be processed by external AI services (Gemini), and SHALL persist a record of this disclosure acceptance alongside the PrivacyPolicyAcceptance record.
6. WHEN a user authenticates successfully via Microsoft Entra External ID, THE Platform SHALL establish an application session using Auth.js as an OIDC integration layer only.
7. WHEN a user authentication attempt fails due to invalid credentials, THE Platform SHALL apply temporary account lockout or CAPTCHA challenge after a configurable number of consecutive failures, as enforced by Microsoft Entra External ID policy.
8. THE Platform SHALL write an AuditLog entry for each of the following authentication events: registration, email verification, login, logout, failed login, password reset initiation, role change.
9. WHERE social identity providers are enabled in the Entra External ID tenant, THE Platform SHALL support user login via those configured social identity providers without requiring a separate Platform password.
10. WHEN a user requests a password reset, THE Platform SHALL delegate the password reset flow entirely to Microsoft Entra External ID and SHALL NOT expose a separate Platform-managed password reset endpoint.

---

### Requirement 2: Project Management

**User Story:** As a user, I want to create and manage named projects for each property I am evaluating, so that my work is organized and retrievable.

#### Acceptance Criteria

1. THE Platform SHALL allow an authenticated User to create a Project with a required name and an optional description.
2. THE Platform SHALL persist each Project with an owner User reference, a creation timestamp, a last-modified timestamp, and a lifecycle state of ACTIVE or ARCHIVED.
3. WHEN a User views their project list, THE Platform SHALL display only ACTIVE Projects by default.
4. THE Platform SHALL provide a separate archived-projects view that lists all ARCHIVED Projects for the authenticated User.
5. WHEN a User archives a Project, THE Platform SHALL set the Project's archivedAt timestamp and transition its state to ARCHIVED without deleting any associated data.
6. WHEN a User unarchives a Project, THE Platform SHALL clear the archivedAt timestamp and transition the Project state back to ACTIVE.
7. WHEN a User attempts to access a Project not owned by the User, THE Platform SHALL return a 403 Forbidden response and write an AuditLog entry.
8. THE Platform SHALL allow an authenticated User to update the name and description of a Project in ACTIVE state.

---

### Requirement 3: Property Location Input and Geocoding

**User Story:** As a user, I want to enter my property's location by address or PIN code, so that the Platform can derive its geographic coordinates for climate and dealer discovery.

#### Acceptance Criteria

1. THE Platform SHALL accept a property location from a User as either a free-text address or a postal/PIN code.
2. WHEN a User submits a location, THE GeocodingService SHALL resolve the input to a geographic coordinate pair (latitude, longitude) using the configured primary GeocodingProvider.
3. THE GeocodingService SHALL support Google Geocoding API and Mappls Geocoding API as configurable provider implementations (GoogleGeocodingClient, MapplsGeocodingClient).
4. WHEN the primary GeocodingProvider fails, THE GeocodingService SHALL fall back to the secondary configured GeocodingProvider and record the fallback event in the DataSource provenance record.
5. IF the GeocodingService cannot resolve the location after exhausting all configured providers, THEN THE Platform SHALL present the User with a descriptive error message and SHALL NOT proceed to climate retrieval.
6. THE Platform SHALL persist resolved coordinates with the Project's location record, tagged with the GeocodingProvider that produced the result and the provenance value USER_PROVIDED for the input and DERIVED for the coordinates.
7. THE Platform SHALL display the resolved address and map coordinates to the User for confirmation before persisting the location.
8. IF Mappls geocoding integration is not available in the current release, THE Platform documentation SHALL explicitly mark Mappls geocoding as deferred, and Google Geocoding SHALL remain the operative primary provider.

---

### Requirement 4: Climate Profile Retrieval

**User Story:** As a user, I want the Platform to automatically fetch a year-round climate profile for my property's location, so that paint recommendations account for the local environment.

#### Acceptance Criteria

1. WHEN a Project location is confirmed, THE ClimateService SHALL retrieve a ClimateProfile covering at minimum: monthly average temperature (°C), monthly average relative humidity (%), monthly total rainfall (mm), average UV index by season, prevailing wind direction and average speed, and annual freeze-thaw cycle count.
2. THE ClimateProfile SHALL be stored in the ClimateProfiles table with a provenance field set to VERIFIED when retrieved directly from the primary climate/weather data API.
3. WHEN the primary climate data source is unavailable, THE ClimateService SHALL retrieve climate data from a regional aggregate climate dataset and set the ClimateProfile provenance to DERIVED.
4. WHEN a ClimateProfile with DERIVED provenance is used, THE Platform SHALL display a clearly visible notice to the User stating that regional average climate data was used in place of direct local data.
5. THE Platform SHALL persist the data source identifier, retrieval timestamp, and provenance for every ClimateProfile in the DataSources table.
6. THE ClimateService SHALL retry the primary climate data source a configurable number of times before falling back to the regional aggregate dataset.
7. IF no climate data can be obtained from any source, THEN THE Platform SHALL inform the User and SHALL NOT generate paint recommendations without a valid ClimateProfile.

---

### Requirement 5: Image Upload

**User Story:** As a user, I want to upload multiple photographs of my home or rooms, so that the Platform can analyze the property visually.

#### Acceptance Criteria

1. THE Platform SHALL accept upload of between 1 and a configurable maximum number of image files per Project per upload session.
2. THE Platform SHALL accept images in JPEG, PNG, and WebP formats with a configurable maximum file size per image.
3. WHEN an image file is received, THE Platform SHALL assign the ProjectImage a processing state of UPLOADED and persist the image to object storage before confirming upload success to the User.
4. THE Platform SHALL enforce upload rate limits per User, configurable via the centralized rate-limit configuration.
5. IF an uploaded file exceeds the maximum size limit or is not in an accepted format, THEN THE Platform SHALL return a descriptive validation error and SHALL NOT store the rejected file.
6. THE Platform SHALL allow a User to remove a ProjectImage from a Project before analysis has completed; upon removal THE Platform SHALL transition the ProjectImage state to DELETED and SHALL NOT include the image in any subsequent analysis or recommendation run.
7. THE Platform SHALL display a real-time upload progress indicator to the User for each image being uploaded.

---

### Requirement 6: AI Image Analysis

**User Story:** As a user, I want the Platform to analyze my uploaded photographs automatically, so that paint recommendations reflect the actual structure and character of my property.

#### Acceptance Criteria

1. WHEN a ProjectImage reaches UPLOADED state, THE ImageAnalysisService SHALL enqueue the image for analysis by transitioning its state to QUEUED.
2. WHEN an image analysis job begins processing, THE ImageAnalysisService SHALL transition the ProjectImage state to PROCESSING.
3. THE ImageAnalysisService SHALL use the configured Gemini image analysis model (identified by the IMAGE_ANALYSIS_MODEL environment variable) to analyze each ProjectImage and extract: space type (room category or exterior), interior/exterior classification, facade type, floor count (where visible), architectural style, visible surface types and materials, natural light quality and direction, and paintable regions.
4. THE ImageAnalysisService SHALL store each extracted field in an ImageAnalysisResult record with an AnalysisState of AI_INFERRED and a confidence score for each field.
5. WHEN image analysis completes successfully, THE ImageAnalysisService SHALL transition the ProjectImage state to COMPLETED.
6. WHEN image analysis fails, THE ImageAnalysisService SHALL transition the ProjectImage state to RETRYING for up to a configurable retry count, then to FAILED if all retries are exhausted.
7. IF the Gemini API returns a safety refusal for an image, THEN THE ImageAnalysisService SHALL record the refusal reason in the ImageAnalysisResult and transition the ProjectImage state to FAILED without further retries.
8. IF the Gemini API returns a timeout or quota/rate-limit error, THEN THE ImageAnalysisService SHALL apply exponential back-off retry and transition the ProjectImage state to RETRYING.
9. THE ImageAnalysisService SHALL log all Gemini API interaction errors (timeout, quota exceeded, safety refusal, invalid response, permanent failure) in the AuditLog without logging image binary data or personal data.
10. WHEN multiple ProjectImages belong to a single Project in Wave 1, THE ImageAnalysisService SHALL analyze each image independently and store a separate ImageAnalysisResult per ProjectImage.

---

### Requirement 7: Image Analysis Review and Correction

**User Story:** As a user, I want to review the AI-inferred analysis of my photographs and correct any errors before receiving paint recommendations, so that recommendations are based on accurate property data.

#### Acceptance Criteria

1. WHEN all ProjectImages in a Project have reached COMPLETED or FAILED state, THE Platform SHALL present the User with an Analysis Review UI displaying the ImageAnalysisResult for each COMPLETED image.
2. THE Analysis Review UI SHALL expose the following fields per ImageAnalysisResult: space type, interior/exterior classification, facade type, floor count, architectural style, visible surfaces and materials, natural light quality and direction, paintable regions, and the AI-inferred confidence score for each field.
3. THE Analysis Review UI SHALL visually distinguish fields with AnalysisState AI_INFERRED from fields with AnalysisState USER_CONFIRMED or USER_OVERRIDDEN.
4. WHEN a User modifies an AI-inferred field, THE Platform SHALL update the field value, set its AnalysisState to USER_OVERRIDDEN, and persist the change to the ImageAnalysisResult record.
5. WHEN a User confirms an AI-inferred field without modification, THE Platform SHALL update the field's AnalysisState to USER_CONFIRMED.
6. THE Platform SHALL use USER_OVERRIDDEN and USER_CONFIRMED field values in preference to AI_INFERRED values when supplying ImageAnalysisResult data to the recommendation engine.
7. WHEN a User submits the Analysis Review, THE Platform SHALL validate that the ApplicationScope (INTERIOR, EXTERIOR, or BOTH) is consistent with the confirmed image classifications and SHALL warn the User of any inconsistencies before proceeding.

---

### Requirement 8: Paint Manufacturer and Scope Selection

**User Story:** As a user, I want to select my preferred paint manufacturer and the application scope, so that recommendations are specific and actionable.

#### Acceptance Criteria

1. THE Platform SHALL present the User with a choice of exactly four supported Manufacturers: Asian Paints, Birla Opus, Nerolac, and Berger Paints.
2. THE Platform SHALL allow the User to select an ApplicationScope of INTERIOR, EXTERIOR, or BOTH.
3. THE Platform SHALL only surface PaintShades belonging to the selected Manufacturer in recommendation output.
4. THE Platform SHALL accept, validate, and persist an ApplicationScope of INTERIOR, EXTERIOR, or BOTH in Wave 1. WHEN the ApplicationScope is BOTH, THE Platform SHALL produce separate ranked recommendation sets for interior surfaces and exterior surfaces in Wave 2.
5. THE Platform SHALL persist the User's Manufacturer and ApplicationScope selections with the RecommendationRun record.
6. WHERE only a subset of Manufacturers has a populated catalogue in the MVP Manufacturer Catalogue, THE Platform SHALL clearly indicate to the User which Manufacturers are available for the current release and which are planned for future release.

---

### Requirement 9: Paint Recommendation Engine

**User Story:** As a user, I want to receive five paint recommendations that are scientifically matched to my home's climate, surfaces, and architectural character, so that I can make a confident paint choice.

#### Acceptance Criteria

1. THE RecommendationEngine SHALL generate recommendations using only PaintShades with a provenance of VERIFIED in the PaintShades table — referencing the manufacturer's official shade name and shade code — and SHALL NOT invent or interpolate shade names or codes.
2. THE RecommendationEngine SHALL score each eligible PaintShade candidate against exactly nine weighted scoring factors: Climate Suitability, Interior/Exterior Compatibility, Surface Compatibility, Product Suitability, Architectural Characteristics, Room Type, Natural Light, Colour Family Compatibility, and User Preferences.
3. THE RecommendationEngine SHALL compute a composite score as the configurable weighted sum of the nine factor scores.
4. THE ScoringWeights applied to the nine factors SHALL be configurable, persisted in the ScoringWeightVersion table, and versioned; each RecommendationRun SHALL record the foreign key and version string of the ScoringWeightVersion used.
5. WHEN the composite scoring is complete, THE RecommendationEngine SHALL sort candidates by composite score descending, using shade identifier ascending as a deterministic tie-breaker.
6. THE RecommendationEngine SHALL apply the PaletteHarmony rule as a post-scoring selection step, NOT as a weighted scoring factor.
7. THE PaletteHarmony rule SHALL be applied as follows: after sorting, if the top five candidates are excessively concentrated in one colour family (defined as four or more candidates sharing the same colour family), the RecommendationEngine SHALL search the next highest-ranked candidates (positions 6 through 15, inclusive) for a candidate from a different colour family; if such a candidate is found and satisfies all mandatory compatibility rules, THE RecommendationEngine SHALL replace the lowest-ranked of the concentrated candidates with the replacement candidate and maintain deterministic score-descending order.
8. WHEN fewer than five valid PaintShade candidates pass all mandatory compatibility filters, THE RecommendationEngine SHALL apply a deterministic relaxation sequence: first relax Colour Family Compatibility, then relax Natural Light compatibility, then relax Room Type compatibility, then relax Architectural Characteristics compatibility — applying each relaxation step in this exact order and stopping as soon as five candidates are available.
9. IF fewer than five valid recommendations remain after all four relaxation steps, THE Platform SHALL return all available valid recommendations (minimum one) and SHALL include a clear explanation to the User of which filters were relaxed and why fewer than five recommendations were returned.
10. THE RecommendationEngine SHALL store each recommendation's individual scores for all nine factors in the RecommendationFactors table alongside the composite score.
11. THE RecommendationEngine SHALL NOT use Palette Harmony as a weighted scoring factor, tenth scoring factor, or part of the composite weighted score at any point.
12. WHEN the ApplicationScope is INTERIOR or EXTERIOR, THE RecommendationEngine SHALL return a single ranked list of five recommendations in Wave 1. WHEN the ApplicationScope is BOTH (Wave 2), THE RecommendationEngine SHALL return two separate ranked lists of five recommendations each — one for interior surfaces and one for exterior surfaces.

---

### Requirement 10: Recommendation Explanation

**User Story:** As a user, I want to understand why each paint was recommended, so that I can evaluate recommendations with confidence.

#### Acceptance Criteria

1. THE Platform SHALL present each of the five recommendations with a human-readable explanation of the top contributing scoring factors.
2. THE Platform SHALL display for each recommendation: the manufacturer shade name, shade code, product name, finish type, composite score, and the individual score for each of the nine scoring factors.
3. THE Platform SHALL indicate whether the PaletteHarmony replacement rule was applied to the final recommendation set, and if so, which candidate was replaced and why.
4. IF a recommendation set contains fewer than five items, THE Platform SHALL display a clear explanation of which relaxation steps were applied and which filters were relaxed.
5. THE Platform SHALL display the ScoringWeights version used for the RecommendationRun so that users and administrators can trace scoring decisions.

---

### Requirement 11: Basic Dealer Discovery (Wave 1)

**User Story:** As a user, I want to find nearby dealers stocking my recommended paints, so that I can purchase them conveniently.

#### Acceptance Criteria

1. WHEN a User requests dealer discovery for a Manufacturer, THE DealerDiscoveryService SHALL query a configured third-party discovery provider (Google Places API or Mappls) using the Project's confirmed geographic coordinates and the Manufacturer name.
2. THE Platform SHALL store discovered dealers in the Dealers table with a DealerState of THIRD_PARTY_DISCOVERED.
3. THE Platform SHALL NOT automatically assign a DealerState of VERIFIED_OFFICIAL to any dealer discovered via Google Places or Mappls without a separate authoritative manufacturer verification step.
4. THE Platform SHALL display dealer name, address, distance from the property, and DealerState to the User.
5. WHEN a User views dealer results, THE Platform SHALL clearly distinguish VERIFIED_OFFICIAL dealers from THIRD_PARTY_DISCOVERED and UNVERIFIED dealers.

---

### Requirement 12: Paint Shade Catalogue Integrity

**User Story:** As a platform operator, I want the shade catalogue to contain only verified manufacturer data, so that recommendations are accurate and legally defensible.

#### Acceptance Criteria

1. THE Platform SHALL maintain PaintShade records with provenance VERIFIED only for shades whose shade name and shade code have been sourced from an authoritative manufacturer data source documented in the DataSources table.
2. THE Platform SHALL record for each PaintShade: the source identifier, source URL or reference, retrieval or entry timestamp, and the catalogue operator who approved the entry.
3. THE Platform SHALL NOT generate a recommendation referencing a PaintShade record whose provenance is not VERIFIED.
4. THE Platform SHALL provide administrative tooling (Wave 4) for managing PaintShade records, including approval workflows and audit history.
5. THE Platform SHALL store PaintShadeSources records linking each PaintShade to one or more DataSources for full traceability.

---

### Requirement 13: Privacy and Data Handling

**User Story:** As a user, I want to know how my data and images are used, and to have the right to access and delete my data, so that my privacy is respected.

#### Acceptance Criteria

1. THE Platform SHALL present a Privacy Policy to Users at registration and SHALL NOT complete registration without explicit User acceptance.
2. THE Platform SHALL persist for each User: the privacyPolicyVersion accepted, the privacyAcceptedAt timestamp, and the explicit AI-data-processing disclosure acceptance.
3. WHEN a User submits a DSAR, THE Platform SHALL compile and deliver an export of all personal data associated with that User within the legally required response window (Wave 4).
4. WHEN a User requests account deletion, THE Platform SHALL permanently delete or anonymize all personal data associated with that User in compliance with applicable regulations, within a configurable retention period (Wave 4).
5. THE Platform SHALL ensure that uploaded images are transmitted to Gemini API services over encrypted transport and are not retained by the Platform beyond the configured image retention period.
6. THE EmailService SHALL NOT log plaintext email content, credentials, or personally identifiable information in application logs.

---

### Requirement 14: Email Notifications

**User Story:** As a user, I want to receive transactional email notifications for key events, so that I can act on them promptly.

#### Acceptance Criteria

1. THE EmailService SHALL send an email verification message to a new User's registered email address during the registration flow, as coordinated with Microsoft Entra External ID.
2. THE EmailService SHALL support at minimum the following notification types: email verification, password reset coordination (where Entra External ID delegates email delivery), privacy or DSAR notifications.
3. THE EmailService SHALL use configurable email templates for each notification type.
4. WHEN an email delivery fails, THE EmailService SHALL retry delivery a configurable number of times using exponential back-off before marking the notification as permanently failed.
5. THE EmailService SHALL record the delivery status of each notification without logging the plaintext message body or the recipient's personal data beyond the email address.
6. THE EmailService SHALL obtain all provider credentials (API keys, SMTP credentials) exclusively from environment variables or a secrets manager — never from database configuration tables.

---

### Requirement 15: Rate Limiting

**User Story:** As a platform operator, I want configurable rate limits on key operations, so that the Platform is protected from abuse and resource exhaustion.

#### Acceptance Criteria

1. THE Platform SHALL enforce configurable rate limits on: API requests per User per minute, image uploads per User per day, recommendation generation runs per User per day, and visualization generation jobs per User per day.
2. WHEN a User exceeds a rate limit, THE Platform SHALL return an HTTP 429 response with a Retry-After header indicating when the limit resets.
3. THE Platform SHALL store all rate-limit thresholds in a centralized rate-limit configuration — not hardcoded in individual service implementations.
4. THE Platform SHALL record rate-limit violations in the AuditLog.

---

### Requirement 16: System Security

**User Story:** As a platform operator, I want the Platform to follow secure-by-default practices, so that user data and platform integrity are protected.

#### Acceptance Criteria

1. THE Platform SHALL store all secrets (API keys, OAuth client secrets, database passwords, connection string secrets) exclusively in environment variables or Azure Key Vault — never in SystemConfig database records or source code.
2. THE Platform SHALL enforce HTTPS for all client-server and service-to-service communication.
3. THE Platform SHALL validate and sanitize all User-supplied inputs (location text, project name, description, image metadata) before processing.
4. THE Platform SHALL enforce role-based access control ensuring that Users can access only their own Projects, Images, Analysis Results, and Recommendations.
5. THE Platform SHALL apply OWASP Top 10 mitigations as a baseline security standard.
6. WHEN an authorization violation is detected, THE Platform SHALL return a 403 Forbidden response and write an AuditLog entry recording the User, resource, and attempted action.

---

### Requirement 17: Performance Targets

**User Story:** As a user, I want the Platform to respond quickly and handle reasonable load, so that the experience is fluid and professional.

#### Acceptance Criteria

1. THE Platform SHALL achieve a Largest Contentful Paint (LCP) of under 2.5 seconds for primary pages under MVP/baseline load conditions (up to 50 concurrent users).
2. THE Platform SHALL return API responses for non-analysis, non-recommendation endpoints within 500 ms at the 95th percentile under MVP/baseline load.
3. THE Platform SHALL complete a recommendation generation run within 10 seconds at the 95th percentile under MVP/baseline load.
4. THE Platform SHALL complete image analysis for a single image (Gemini API round-trip included) within 30 seconds at the 95th percentile under MVP/baseline load.
5. WHILE the Platform is operating under production target load (up to 500 concurrent users), THE Platform SHALL sustain the LCP and API response targets defined in the production performance specification with no more than a 20% degradation from baseline.
6. THE Platform SHALL define and document production performance targets (concurrent users, LCP, API p95, recommendation generation p95, image analysis p95, visualization generation p95, queue processing throughput) in the design document as a baseline for Wave 5 production hardening.

---

### Requirement 18: Audit Logging

**User Story:** As a compliance officer, I want a tamper-evident audit log of security and data-relevant events, so that the Platform can demonstrate compliance.

#### Acceptance Criteria

1. THE AuditLog SHALL record: event type, User identifier, resource type and identifier, timestamp, source IP address, outcome (success or failure), and any additional context relevant to the event type.
2. THE Platform SHALL write AuditLog entries for: authentication events (as specified in Requirement 1), authorization violations (as specified in Requirement 16), DSAR submissions and completions, account deletions, role changes, scoring weight changes, and catalogue approval actions.
3. THE Platform SHALL NOT allow AuditLog records to be modified or deleted by application-level operations.
4. THE Platform SHALL provide administrative read access to AuditLog records (Wave 4).

---

### Requirement 19: Visualization (Wave 3)

**User Story:** As a user, I want to see a visual preview of recommended paint colours applied to my home's photographs, so that I can make a more informed decision.

#### Acceptance Criteria

1. WHEN a User selects "Visualize this image" for a ProjectImage, THE Platform SHALL record the selected ProjectImage as the sourceImageId for the ImageGenerationJob and SHALL NOT use any other image without explicit User selection.
2. THE Platform SHALL submit the ImageGenerationJob to the visualization queue using the configured Gemini image model (identified by the GEMINI_IMAGE_MODEL environment variable).
3. THE GEMINI_IMAGE_MODEL and IMAGE_ANALYSIS_MODEL SHALL be configured as separate environment variables to allow independent model selection.
4. WHEN a visualization job fails due to API timeout, quota exhaustion, or rate limit, THE Platform SHALL apply exponential back-off retry up to a configurable maximum retry count.
5. WHEN a visualization job fails due to a Gemini safety refusal, THE Platform SHALL attempt generation using the configured GeminiFallbackPrompt for that image context.
6. WHEN all retry and fallback attempts fail, THE Platform SHALL transition the ImageGenerationJob to FAILED state, notify the User, and record the failure reason in the AuditLog.
7. THE Platform SHALL store GeneratedImages in object storage and link each GeneratedImage to its source ImageGenerationJob and sourceImageId.
8. WHERE an indicative preview or watermarked image is used prior to full generation, THE Platform SHALL clearly label the image as an indicative preview and SHALL NOT present it as a finalized result.
9. Visualization generation, visualization job processing, generated-image storage, and visualization UI are scoped to Wave 3 and SHALL NOT be required for Wave 1 E2E vertical slice tests.

---

### Requirement 20: Multi-Image Aggregation (Wave 2)

**User Story:** As a user, I want the Platform to synthesize insights from all my uploaded photographs, so that recommendations reflect my entire property rather than individual images.

#### Acceptance Criteria

1. WHEN the ApplicationScope is BOTH and multiple ProjectImages have COMPLETED analysis (Wave 2), THE CrossImageAggregationService SHALL combine per-image ImageAnalysisResults into a project-level synthesis, applying conflict-resolution rules for contradictory field values.
2. THE CrossImageAggregationService SHALL record the aggregation method, conflict resolutions applied, and synthesis provenance in the ProjectAnalysisSynthesis table at project level.
3. THE RecommendationEngine SHALL use the ProjectAnalysisSynthesis record as its primary input when available, falling back to per-image analysis results when no synthesis exists (Wave 1 behavior).
4. Advanced segmentation using SAM2 is an optional enhancement within Wave 2 and SHALL be architecturally separable from the core analysis pipeline.

---

### Requirement 21: Roles and Access Control

**User Story:** As a platform operator, I want clearly defined user roles, so that access to features and data is controlled appropriately.

#### Acceptance Criteria

1. THE Platform SHALL support the following roles in the current release: User (authenticated homeowner), and Administrator (platform operator with catalogue and audit access).
2. THE Platform SHALL enforce that a User role can create and manage only their own Projects, Images, Analyses, and Recommendations.
3. THE Platform SHALL enforce that the Administrator role can access AuditLogs, manage PaintShade catalogues, manage ScoringWeights versions, and view system-level configuration — but SHALL NOT access other Users' Projects or Images.
4. Guest and Support Agent roles are deferred and out of scope for the current release. THE Platform SHALL NOT implement Guest or Support Agent role functionality in Waves 0 through 5 unless explicitly re-scoped.

---
