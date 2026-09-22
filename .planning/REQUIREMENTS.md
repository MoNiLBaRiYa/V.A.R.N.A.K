# Requirements: V.A.R.N.A.K. — Climate-Aware Home Paint Recommendation & Visualization Platform

**Defined:** 2026-09-22
**Core Value:** Delivering scientifically grounded, climate-durable, and architecturally harmonious paint recommendations using strictly verified manufacturer shade codes, substantiated by AI property vision analysis and photorealistic previews.

## v1 Requirements

### Authentication & Identity

- [ ] **REQ-01**: User Registration and Authentication via Microsoft Entra External ID with Auth.js v5 session layer and audit logging.
- [ ] **REQ-21**: Administrative Roles and Access Control (USER and ADMIN roles enforced on API routes).

### Project Management & Workspaces

- [ ] **REQ-02**: Project Management allowing authenticated users to create, update, list, and archive named property projects.

### Location & Environmental Profiling

- [ ] **REQ-03**: Property Location Input and Geocoding via Google Geocoding API with coordinate confirmation.
- [ ] **REQ-04**: Climate Profile Retrieval via Open-Meteo API with regional cached fallback datasets.

### Image Processing & AI Vision

- [ ] **REQ-05**: Image Upload and Azure Blob Storage supporting JPEG, PNG, WebP up to 10MB with processing lifecycle states.
- [ ] **REQ-06**: Asynchronous AI Image Analysis via Gemini Vision extracting room type, architectural features, surfaces, and lighting.
- [ ] **REQ-07**: Image Analysis Review and User Correction UI allowing verification and overriding of AI inferences.

### Recommendation Engine & Catalogue

- [ ] **REQ-08**: Paint Manufacturer and Scope Selection supporting Asian Paints (MVP), Birla Opus, Nerolac, Berger Paints, and Interior/Exterior/Both.
- [ ] **REQ-09**: 9-Factor Paint Recommendation Engine & Palette Harmony returning exactly 5 ranked verified recommendations.
- [ ] **REQ-10**: Recommendation Explanation providing transparent natural language rationale and factor score breakdowns.
- [ ] **REQ-12**: Paint Shade Catalogue Integrity ensuring 100% provenance verification and preventing synthetic shade codes.

### Dealer Discovery

- [ ] **REQ-11**: Basic Dealer Discovery locating authorized brand paint retailers within a search radius via Google Places API.

### Operations, Privacy & Security

- [ ] **REQ-13**: Privacy, Consent, and Self-Service DSAR Management including data export and account/project deletion.
- [ ] **REQ-14**: Transactional Email Notifications via EmailService abstraction (SendGrid / Azure Communication Services).
- [ ] **REQ-15**: Redis-Backed Sliding Window Rate Limiting protecting authentication and API endpoints.
- [ ] **REQ-16**: System Security, Key Vault Secrets Management, HTTPS, strict CSP, and input sanitization.
- [ ] **REQ-17**: Performance Targets satisfying Core Web Vitals (LCP < 2.5s) and recommendation generation < 3.0s.
- [ ] **REQ-18**: Tamper-Evident Audit Logging for authentication, authorization, and administrative events.

### Advanced Capabilities (Waves 2 & 3)

- [ ] **REQ-20**: Multi-Image Whole-Home Feature Aggregation resolving cross-angle attributes for cohesive whole-property palettes.
- [ ] **REQ-19**: Generative Visualization via Gemini Image Generation with fallback prompts, retry handling, and preview UI.

## v2 Requirements

- **EXT-01**: Mappls Geocoding API integration (deferred in v1).
- **EXT-02**: SAM2 (Segment Anything Model 2) interactive local wall polygon segmentation.
- **EXT-03**: Real-time augmented reality mobile camera paint projection preview.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Local Password Database | Microsoft Entra External ID is the exclusive identity authority to eliminate credential leakage risk. |
| Synthetic / AI Hallucinated Paint Shades | All recommendations must match verified manufacturer shade codes from official brand catalogues. |
| In-App E-commerce Checkout | Direct transactional paint sales are out of scope; system routes users to authorized local dealers. |
| Video Stream AI Analysis | Processing is image-based to ensure deterministic quality, reliability, and cost control. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 (Auth) | Phase 2 (MVP) | Pending |
| REQ-02 (Projects) | Phase 2 (MVP) | Pending |
| REQ-03 (Geocoding) | Phase 2 (MVP) | Pending |
| REQ-04 (Climate) | Phase 2 (MVP) | Pending |
| REQ-05 (Image Upload) | Phase 1 (Foundation) & Phase 2 (MVP) | Pending |
| REQ-06 (AI Vision) | Phase 2 (MVP) | Pending |
| REQ-07 (Analysis Review) | Phase 2 (MVP) | Pending |
| REQ-08 (Manufacturer/Scope) | Phase 2 (MVP) & Phase 3 (Depth) | Pending |
| REQ-09 (Rec Engine) | Phase 2 (MVP) & Phase 3 (Depth) | Pending |
| REQ-10 (Rec Explanation) | Phase 2 (MVP) | Pending |
| REQ-11 (Dealer Discovery) | Phase 2 (MVP) | Pending |
| REQ-12 (Catalogue Integrity) | Phase 1 (Foundation) & Phase 2 (MVP) | Pending |
| REQ-13 (Privacy/DSAR) | Phase 5 (Operations/Compliance) | Pending |
| REQ-14 (Email Notifications) | Phase 1 (Foundation) & Phase 2 (MVP) | Pending |
| REQ-15 (Rate Limiting) | Phase 1 (Foundation) & Phase 2 (MVP) | Pending |
| REQ-16 (Security) | Phase 1 (Foundation) & Phase 6 (Hardening) | Pending |
| REQ-17 (Performance) | Phase 6 (Production Hardening) | Pending |
| REQ-18 (Audit Logging) | Phase 1 (Foundation) & Phase 5 (Operations) | Pending |
| REQ-19 (Visualization) | Phase 4 (Visualization) | Pending |
| REQ-20 (Multi-Image) | Phase 3 (Recommendation Depth) | Pending |
| REQ-21 (Roles/RBAC) | Phase 5 (Operations/Compliance) | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21 (100% coverage)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-22*
*Last updated: 2026-09-22 after document ingestion bootstrap*
