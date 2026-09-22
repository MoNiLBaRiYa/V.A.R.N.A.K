# V.A.R.N.A.K. — Climate-Aware Home Paint Recommendation & Visualization Platform

## What This Is

The Climate-Aware Home Paint Recommendation & Visualization Platform (V.A.R.N.A.K. — Visual Architecture & Radiance Navigation with Artificial Knowledge) is a web application that enables homeowners to receive data-driven, manufacturer-specific paint recommendations tailored to their property's geographic climate profile, architectural style, surface characteristics, and personal preferences. Users provide a property location, select a supported manufacturer, choose an application scope (Interior, Exterior, or Both), and upload home photographs. The platform analyzes local climate conditions via Open-Meteo, inspects images using Gemini Vision AI, and ranks verified manufacturer shades using a 9-factor recommendation engine with subsequent visual preview capabilities.

## Core Value

Delivering scientifically grounded, climate-durable, and architecturally harmonious paint recommendations using strictly verified manufacturer shade codes, substantiated by AI property vision analysis and photorealistic previews.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] REQ-01: User Registration and Authentication via Microsoft Entra External ID
- [ ] REQ-02: Project Management and Property Workspaces
- [ ] REQ-03: Property Location Input and Google Geocoding
- [ ] REQ-04: Climate Profile Retrieval via Open-Meteo
- [ ] REQ-05: Image Upload and Azure Blob Storage
- [ ] REQ-06: Asynchronous AI Image Analysis via Gemini Vision
- [ ] REQ-07: Image Analysis Review and User Correction UI
- [ ] REQ-08: Paint Manufacturer and Application Scope Selection
- [ ] REQ-09: 9-Factor Paint Recommendation Engine & Palette Harmony
- [ ] REQ-10: Recommendation Explanation & Score Breakdown
- [ ] REQ-11: Basic Dealer Discovery via Google Places API
- [ ] REQ-12: Paint Shade Catalogue Provenance & Integrity
- [ ] REQ-13: Privacy, Consent, and Self-Service DSAR Management
- [ ] REQ-14: Asynchronous Email Notifications via EmailService
- [ ] REQ-15: Redis-Backed Sliding Window Rate Limiting
- [ ] REQ-16: System Security, Secrets in Key Vault, and RBAC
- [ ] REQ-17: Performance Targets and Core Web Vitals SLOs
- [ ] REQ-18: Tamper-Evident Audit Logging
- [ ] REQ-19: Generative Visualization via Gemini Image Generation (Wave 3)
- [ ] REQ-20: Multi-Image Whole-Home Feature Aggregation (Wave 2)
- [ ] REQ-21: Administrative Roles and Catalogue Access Control

### Out of Scope

- **Independent local password authentication** — Microsoft Entra External ID is the sole identity authority; local credential storage is explicitly forbidden.
- **Arbitrary or synthetic shade generation** — Recommendations must strictly match official manufacturer shade codes from Asian Paints, Birla Opus, Nerolac, or Berger Paints.
- **In-app paint e-commerce checkout** — The platform connects users to authorized dealers rather than processing direct paint sales transactions.
- **Real-time video/AR stream processing** — Processing is asynchronous and image-based to ensure deterministic quality and reliability.
- **Mappls Geocoding API** — Deferred for initial releases; Google Geocoding is the primary operative provider.

## Context

- **Architecture**: Next.js 14 (App Router) deployed on Azure App Service with server and client components strictly decoupled.
- **Identity**: Microsoft Entra External ID integrated via Auth.js v5 as an OIDC session management layer.
- **Data & Storage**: Azure SQL Database with Prisma 5 ORM defining 23 database models from Design §4; Azure Blob Storage for original and generated imagery; Azure Cache for Redis for rate limiting and BullMQ background job processing.
- **AI Pipelines**: Google Gemini Vision for architectural and surface inspection; Google Gemini Image Generation for Wave 3 color previews.
- **Manufacturers**: Asian Paints (Wave 1 MVP); Birla Opus, Nerolac, and Berger Paints (Wave 2).

## Constraints

- **Tech Stack**: Next.js 14, TypeScript, Prisma 5 (23 models), Azure SQL Database, Tailwind CSS.
- **Identity & Auth**: Microsoft Entra External ID is the exclusive identity authority; local credential stores are prohibited.
- **Catalogue Integrity**: Zero hallucinated or synthetic shades; all recommendations require verified manufacturer provenance.
- **Job Processing**: In Wave 0 Foundation, BullMQ manages `image-analysis-queue` and `recommendation-queue`. `visualization-queue` belongs to Wave 3.
- **Recommendation Scoring**: Exactly 9 factors (Climate suitability, Interior/exterior compatibility, Surface compatibility, Product suitability, Architectural characteristics, Room type, Natural light, Colour family compatibility, User preferences). Palette Harmony is post-scoring selection, not a tenth factor.
- **Performance**: LCP < 2.5s, FID/INP < 200ms, CLS < 0.1, Recommendation calculation < 3.0s.
- **Security**: Zero secrets in source code; all API keys and connection strings loaded from Azure Key Vault.

## Key Decisions

<decisions>

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 14 App Router + TypeScript | Full-stack unified framework with robust React Server Components and API routes | Locked (DEC-01) |
| Entra External ID + Auth.js v5 | Enterprise-grade identity authority avoiding local credential risk; Auth.js manages OIDC sessions | Locked (DEC-02) |
| Azure SQL Database + Prisma 5 | Reliable relational consistency, migrations, and type-safety across 23 models from Design §4 | Locked (DEC-03) |
| Azure Blob Storage + SAS URLs | Secure, scalable private storage for property uploads and generated visuals | Locked (DEC-04) |
| Redis + BullMQ Asynchronous Queues | Configures image-analysis-queue and recommendation-queue in Wave 0 (visualization in Wave 3) | Locked (DEC-05) |
| Google Gemini API for Vision & Image Gen | Multimodal capability for architectural attribute detection and photorealistic visualization | Locked (DEC-06) |
| Google Geocoding & Open-Meteo Climate | Reliable coordinates resolution with comprehensive year-round climate profiling | Locked (DEC-07) |
| 9-Factor Scoring + Palette Harmony | Exactly 9 factors from Design §7.1; Palette Harmony is deterministic post-scoring selection | Locked (DEC-08) |
| 6-Wave Implementation Model | Phased derisking from foundation (Wave 0) through MVP (Wave 1) to visualization and hardening | Locked (DEC-09) |

</decisions>

---
*Last updated: 2026-09-22 after strict consistency audit against Requirements.md, Design.md, Tasks.md*
