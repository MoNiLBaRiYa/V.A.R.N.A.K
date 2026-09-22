# Project Context & Implementation Roadmapping

Synthesized from: `.kiro/specs/paint-platform/tasks.md`

---

## Delivery Waves Overview
- **Source**: `.kiro/specs/paint-platform/tasks.md#overview`
- **Topic**: Phased Rollout Strategy
- **Summary**:
  The project is executed across six structured waves:
  1. **Wave 0 — Foundation**: Core repository initialization, Next.js 14 setup, Azure SQL & Prisma schema migrations, Azure Blob Storage containers, Azure Cache for Redis, BullMQ setup, Azure Key Vault integration, structured JSON logging, and base rate limiting.
  2. **Wave 1 — MVP**: End-to-end vertical slice from authentication (Entra External ID + Auth.js), project workspace creation, geocoding (Google Geocoding), climate profile retrieval (Open-Meteo), image upload with Azure Blob, Gemini Vision image analysis, analysis review UI, 9-factor recommendation engine (with Asian Paints verified catalogue), recommendation explanation, basic dealer discovery (Google Places), and end-to-end user testing.
  3. **Wave 2 — Recommendation Depth**: Complete paint catalogues for Birla Opus, Nerolac, and Berger Paints; advanced user preferences scoring; Palette Harmony post-filtering; multi-image aggregation for whole-home analysis; `BOTH` application scope; and optional SAM2 advanced image segmentation.
  4. **Wave 3 — Visualization**: Generative paint previews via Gemini Image Generation; BullMQ visualization worker; retry and fallback prompt pipeline; generated image storage; before/after comparison UI; and verified official manufacturer dealer locator integration.
  5. **Wave 4 — Operations & Compliance**: Self-service DSAR data export and account deletion; admin catalogue management and approval workflows; versioned scoring weights administration; comprehensive audit reporting; and PDF export of recommendations.
  6. **Wave 5 — Production Hardening**: Performance optimization (LCP < 2.5s), WCAG 2.1 AA accessibility audit and fixes, security penetration testing and hardening, automated backup/restore verification, Application Insights monitoring & alerting, and final production acceptance.

## Traceability & Quality Gates
- **Source**: `.kiro/specs/paint-platform/tasks.md`
- **Topic**: Traceability Matrix & Testing
- **Summary**:
  Every functional requirement maps directly to discrete tasks across unit tests, integration tests, UI components, and API handlers. Strict verification gates apply before advancing between waves, ensuring that foundational infrastructure and core MVP capabilities are proven before extending into generative visualization and operational compliance.
