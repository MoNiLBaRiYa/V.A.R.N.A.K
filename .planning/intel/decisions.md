# Architectural Decisions

Synthesized from:
- `.kiro/specs/paint-platform/design.md`
- `.kiro/specs/paint-platform/requirements.md`

---

## DEC-01: Framework and Application Architecture
- **Title**: Next.js 14 App Router with TypeScript
- **Source**: `.kiro/specs/paint-platform/design.md#1-architecture-overview`
- **Status**: Locked
- **Scope**: Frontend, API, Runtime
- **Decision Statement**: The application is built using Next.js 14 (App Router) with React 18 and TypeScript, deployed on Azure App Service or Azure Container Apps. Server and client components are strictly delineated. RESTful API route handlers are located under `/api/*`. All intra-service communication is in-process within the Next.js application.

## DEC-02: Identity Authority and Authentication
- **Title**: Microsoft Entra External ID with Auth.js v5 Session Layer
- **Source**: `.kiro/specs/paint-platform/design.md#3-authentication-architecture`
- **Status**: Locked
- **Scope**: Authentication, Security, User Management
- **Decision Statement**: Microsoft Entra External ID serves as the sole identity authority. The platform maintains zero independent credential stores, password hashes, or login endpoints. Auth.js v5 is used strictly as an OIDC client for code exchange and session cookie management (HttpOnly, Secure, SameSite=Lax). Password resets and MFA/lockout policies are delegated exclusively to Entra External ID.

## DEC-03: Primary Database and ORM
- **Title**: Azure SQL Database with Prisma 5 ORM
- **Source**: `.kiro/specs/paint-platform/design.md#4-database-schema`
- **Status**: Locked
- **Scope**: Data Storage, Schema Management
- **Decision Statement**: Azure SQL Database (SQL Server) is the primary relational database, managed via Prisma 5 ORM for type-safe schema definitions and automated migrations. Passwords are never stored in the database.

## DEC-04: Media and Document Storage
- **Title**: Azure Blob Storage for Uploads and Previews
- **Source**: `.kiro/specs/paint-platform/design.md#2-technology-stack`
- **Status**: Locked
- **Scope**: Object Storage, Media Assets
- **Decision Statement**: Raw user image uploads (`ProjectImages`) and generated visualization assets (`GeneratedImages`) are stored in private Azure Blob Storage containers, accessed via time-limited SAS tokens or authenticated API proxies.

## DEC-05: Asynchronous Processing and Caching
- **Title**: Azure Cache for Redis and BullMQ
- **Source**: `.kiro/specs/paint-platform/design.md#2-technology-stack`
- **Status**: Locked
- **Scope**: Job Queue, Rate Limiting, Caching
- **Decision Statement**: Azure Cache for Redis powers distributed rate limiting (sliding window counters) and background job processing using BullMQ. Dedicated queues handle AI vision image analysis and Gemini visualization jobs with explicit retries, exponential backoff, and dead-letter queues.

## DEC-06: AI Image Analysis and Visualization
- **Title**: Gemini Vision and Gemini Image Generation
- **Source**: `.kiro/specs/paint-platform/design.md#10-image-analysis-pipeline`, `#13-visualization-pipeline-wave-3`
- **Status**: Locked
- **Scope**: AI Services, Vision, Generative Previews
- **Decision Statement**: Google Gemini API is utilized for image analysis (detecting architectural style, surfaces, natural lighting, and paintable regions). For Wave 3 visual previews, Gemini Image Generation (`GEMINI_IMAGE_MODEL`) generates realistic color visualizations with pre-configured fallback prompts and safety filtering.

## DEC-07: Geocoding and Climate Data Providers
- **Title**: Google Geocoding & Open-Meteo Climate APIs
- **Source**: `.kiro/specs/paint-platform/design.md#11-climate-service-design`, `#12-geocoding-service-design`
- **Status**: Locked
- **Scope**: Geocoding, Climate Intelligence
- **Decision Statement**: Google Geocoding API is the primary geocoding provider (Mappls deferred to future releases). Open-Meteo API provides high-resolution historical and seasonal climate profiles (temperature, humidity, UV index, rainfall, freeze-thaw cycles), backed by regional aggregate cached fallback datasets.

## DEC-08: Recommendation Engine and Scoring
- **Title**: 9-Factor Recommendation Scoring with Post-Filter Palette Harmony
- **Source**: `.kiro/specs/paint-platform/design.md#7-recommendation-engine-design`, `#8-palette-harmony-algorithm`
- **Status**: Locked
- **Scope**: Recommendation Engine, Color Science
- **Decision Statement**: Paint recommendations are calculated across 9 weighted factors: Climate-surface durability, UV resistance, Moisture/humidity resistance, Architectural style, Natural light compatibility, Regional aesthetic, User preference, Manufacturer finish/sheen, and Undertone harmony. Recommendations must use verified manufacturer shade names and codes. Palette Harmony is enforced post-scoring to prevent monochromatic clumping among the top 5 outputs.

## DEC-09: Phased Wave Delivery Structure
- **Title**: 6-Wave Implementation Model
- **Source**: `.kiro/specs/paint-platform/requirements.md#introduction`, `.kiro/specs/paint-platform/tasks.md`
- **Status**: Locked
- **Scope**: Delivery, Project Roadmap
- **Decision Statement**: Delivery is structured into 6 sequential waves: Wave 0 (Foundation), Wave 1 (MVP E2E Vertical Slice), Wave 2 (Recommendation Depth), Wave 3 (Visualization), Wave 4 (Operations/Compliance), and Wave 5 (Production Hardening).
