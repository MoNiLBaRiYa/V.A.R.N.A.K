# Roadmap: V.A.R.N.A.K. — Climate-Aware Home Paint Recommendation & Visualization Platform

## Overview

This roadmap orchestrates the delivery of V.A.R.N.A.K. across six sequential phases matching the established 6-wave architecture. The journey begins with foundational infrastructure and database setup (Phase 1), executes an end-to-end MVP vertical slice delivering climate-aware paint recommendations with Asian Paints (Phase 2), expands recommendation depth across all four manufacturers with whole-home multi-image aggregation (Phase 3), introduces generative AI paint visualization via Gemini (Phase 4), implements operational compliance and administrative governance (Phase 5), and concludes with production hardening, accessibility, and performance optimization (Phase 6).

## Phases

- [x] **Phase 1: Foundation** - Repository setup, Azure SQL database migrations, Azure Blob Storage, Redis cache, BullMQ worker foundation, logging, and base rate limiting. (Completed 2026-09-25)
- [ ] **Phase 2: MVP Core & E2E Vertical Slice** - Authentication via Entra External ID, project workspaces, Google geocoding, Open-Meteo climate profiling, image upload, Gemini Vision analysis, review UI, 9-factor recommendation engine with Asian Paints verified catalogue, explanation, and dealer discovery.
- [ ] **Phase 3: Recommendation Depth & Multi-Image Aggregation** - Expansion to Birla Opus, Nerolac, and Berger Paints catalogues, advanced user preferences, palette harmony algorithms, multi-image aggregation for cohesive whole-home palettes, and BOTH scope.
- [ ] **Phase 4: Generative Visualization** - Interactive image selection, asynchronous preview rendering via Gemini Image Generation, fallback prompts, retry handling, and side-by-side comparison UI.
- [ ] **Phase 5: Operations, Compliance & Administration** - Self-service DSAR data export and deletion, admin catalogue verification and scoring weight workflows, audit reporting, and PDF export.
- [ ] **Phase 6: Production Hardening & Acceptance** - Core Web Vitals optimization (LCP < 2.5s), WCAG 2.1 AA accessibility remediation, security penetration hardening, backup/restore validation, and production acceptance.

---

## Phase Details

### Phase 1: Foundation
**Goal**: Establish production-ready base infrastructure, database schema, blob storage, Redis queues, authentication foundation, and foundational security controls.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01 (part), REQ-05 (part), REQ-12 (part), REQ-14 (part), REQ-15 (part), REQ-16, REQ-18 (part)
**Success Criteria** (what must be TRUE):
  1. Next.js 14 App Router project builds cleanly with TypeScript, ESLint, and environment configuration loaded from Azure Key Vault.
  2. Prisma migrations successfully create all 25 database models from Design §4 on Azure SQL Database.
  3. Azure Blob Storage client successfully uploads and retrieves test blobs with private SAS authorization.
  4. Redis cache and BullMQ worker queues (image-analysis-queue and recommendation-queue) process background test jobs with retry capabilities.
  5. Structured JSON logging records application events with correlated request IDs.
  6. Microsoft Entra External ID and Auth.js v5 protect /api/v1/* routes, execute user creation callbacks, and pass architectural invariant tests.
**Plans**: 4 plans
- [x] 01-01: Project initialization, linting/formatting, CI/CD pipeline, and Key Vault configuration.
- [x] 01-02: Prisma schema definition (25 models), SQL Server database migrations, and repository data access layer.
- [x] 01-03: Azure Blob Storage service, Redis client, BullMQ worker scaffold (image-analysis-queue, recommendation-queue), structured logging, and rate limiting middleware.
- [x] 01-04: Authentication setup via Microsoft Entra External ID, Auth.js v5 session middleware, post-login callback, and security invariant test suite.

### Phase 2: MVP Core & E2E Vertical Slice
**Goal**: Deliver a complete end-to-end user journey: login, property creation, geocoding, climate profiling, photo upload, Gemini Vision inspection, analysis review, 9-factor recommendation using Asian Paints catalogue, explanation, and dealer discovery.
**Depends on**: Phase 1
**Requirements**: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12, REQ-14, REQ-15, REQ-16, REQ-18
**Success Criteria** (what must be TRUE):
  1. User can authenticate securely via Microsoft Entra External ID with session cookies managed by Auth.js v5.
  2. User can create a project, input an address or PIN code, and have it accurately resolved to coordinates via Google Geocoding.
  3. Platform retrieves and displays a comprehensive climate profile for the property coordinates via Open-Meteo.
  4. User can upload a property photo and review AI-inferred architectural styles, surface materials, and lighting conditions detected by Gemini Vision, with the ability to override attributes.
  5. User can select Asian Paints and receive exactly 5 ranked recommendations with verified shade codes, factor breakdowns, and transparent natural language explanations.
  6. User can view nearby authorized Asian Paints dealers plotted with contact details.
**Plans**: 5 plans
- [x] 02-01: Entra External ID OIDC integration, Auth.js session handling, and Project workspace CRUD.
- [ ] 02-02: Google Geocoding service, location confirmation UI, and Open-Meteo climate profile integration.
- [ ] 02-03: Image upload pipeline, Azure Blob integration, and asynchronous Gemini Vision analysis with BullMQ.
- [ ] 02-04: Image analysis review UI with user override capabilities, and verified Asian Paints shade catalogue seeder.
- [ ] 02-05: 9-factor recommendation scoring engine, natural language explanation generator, dealer discovery via Google Places, and E2E integration test suite.

### Phase 3: Recommendation Depth & Multi-Image Aggregation
**Goal**: Expand recommendation capabilities across all four manufacturers, add fine-grained preference scoring, implement palette harmony diversity filtering, and support whole-property multi-image aggregation.
**Depends on**: Phase 2
**Requirements**: REQ-08, REQ-09, REQ-20
**Success Criteria** (what must be TRUE):
  1. Users can select and receive recommendations from Birla Opus, Nerolac, and Berger Paints official catalogues in addition to Asian Paints.
  2. Recommendations satisfy Palette Harmony rules, preventing monochromatic saturation in the top 5 outputs.
  3. Multiple photos across rooms or exterior elevations are aggregated into a consistent property-level aesthetic profile.
  4. Users selecting `BOTH` application scope receive harmonized interior-exterior palette pairings.
**Plans**: 3 plans
- [ ] 03-01: Ingestion and verification pipelines for Birla Opus, Nerolac, and Berger Paints catalogues.
- [ ] 03-02: Palette Harmony post-scoring filtering and filter relaxation fallback sequence.
- [ ] 03-03: Multi-image aggregation service, cross-angle attribute resolution, and whole-home palette coordination.

### Phase 4: Generative Visualization
**Goal**: Provide realistic AI-generated previews of recommended paint shades applied directly to user-uploaded home photographs.
**Depends on**: Phase 3
**Requirements**: REQ-19
**Success Criteria** (what must be TRUE):
  1. User can choose a recommended paint shade and trigger an asynchronous visualization job for an uploaded photo.
  2. Gemini Image Generation creates realistic color preview images honoring architectural structure and natural lighting.
  3. Refusal handling and fallback prompts successfully recover from safety rejections without crashing the job.
  4. User can compare original and preview images in an interactive side-by-side comparison viewer with AI disclosures and watermarks.
**Plans**: 2 plans
- [ ] 04-01: BullMQ visualization worker, Gemini Image Generation integration, retry/fallback prompt logic, and Azure Blob storage of rendered outputs.
- [ ] 04-02: Interactive visualization viewer UI, before/after comparison slider, watermarking, and preview download options.

### Phase 5: Operations, Compliance & Administration
**Goal**: Deploy self-service privacy controls (DSAR), administrative catalogue curation, versioned scoring weight governance, and comprehensive audit reporting.
**Depends on**: Phase 4
**Requirements**: REQ-13, REQ-18, REQ-21
**Success Criteria** (what must be TRUE):
  1. Users can download a full archive of their personal data and uploaded photos via self-service DSAR export.
  2. Users can delete their account and projects, triggering complete deletion from database and blob storage.
  3. Administrators can inspect, update, and approve catalogue shades and versioned scoring weights via protected admin views.
  4. System audit log provides an unalterable history of security events, administrative changes, and user consent records.
  5. Users can export their recommendation results and explanations as formatted PDF reports.
**Plans**: 3 plans
- [ ] 05-01: Self-service DSAR export and account/project deletion pipeline with automated blob cleanup.
- [ ] 05-02: Administrative portal with RBAC for catalogue verification, shade approval, and scoring weight calibration.
- [ ] 05-03: Audit log viewer, compliance reporting, and PDF recommendation summary export generator.

### Phase 6: Production Hardening & Acceptance
**Goal**: Maximize performance, ensure accessibility standards compliance, conduct security hardening, verify disaster recovery, and complete final production readiness review.
**Depends on**: Phase 5
**Requirements**: REQ-16, REQ-17
**Success Criteria** (what must be TRUE):
  1. Public and authenticated web pages achieve Core Web Vitals targets: LCP < 2.5s, FID/INP < 200ms, CLS < 0.1.
  2. All user flows comply with WCAG 2.1 AA accessibility guidelines with zero critical axe-core violations.
  3. Security penetration testing confirms zero critical vulnerabilities, valid TLS 1.3, and strict CSP configuration.
  4. Automated backup and restore runbook for Azure SQL and Azure Blob Storage is executed and validated.
**Plans**: 2 plans
- [ ] 06-01: Performance optimization, image compression/caching, CDN configuration, and WCAG 2.1 AA accessibility audit & fixes.
- [ ] 06-02: Security penetration hardening, CSP configuration, automated backup/restore verification, Application Insights alerting, and production acceptance sign-off.

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete | 2026-09-25 |
| 2. MVP Core & E2E Vertical Slice | 1/5 | In Progress | - |
| 3. Recommendation Depth & Multi-Image | 0/3 | Not started | - |
| 4. Generative Visualization | 0/2 | Not started | - |
| 5. Operations, Compliance & Administration | 0/3 | Not started | - |
| 6. Production Hardening & Acceptance | 0/2 | Not started | - |
