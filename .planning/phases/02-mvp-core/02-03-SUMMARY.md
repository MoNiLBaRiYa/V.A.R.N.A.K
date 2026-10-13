# Phase 2 Plan 02-03 Summary: Image Ingestion Pipeline & Asynchronous Gemini Vision Worker

## Status: COMPLETE
- **Phase**: 02-mvp-core
- **Plan**: 02-03
- **Wave**: 2
- **Completed**: 2026-10-13

---

## Deliverables & Architecture Implemented

### 1. Secure Image Upload Pipeline & Rate Limiting (`REQ-05`, `REQ-15`, `REQ-16`, `REQ-18`)
- `src/lib/images/upload-service.ts`:
  - `validateImageBuffer`: Inspects magic bytes (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WebP: `RIFF...WEBP`), checks against allowed MIME list, and strictly enforces 10 MB maximum file size (`MAX_IMAGE_FILE_SIZE_BYTES`).
  - `uploadImageToStorage`: Uploads validated image buffers directly into private Azure Blob Storage container (`project-images`).
- Endpoints:
  - `POST /api/v1/projects/[id]/images`:
    - Enforces tenant isolation and active project status (rejects `ARCHIVED` projects with HTTP 409 Conflict).
    - Enforces rate limit at exactly 20 uploads/day/user (`RATE_LIMIT_CONFIGS.IMAGE_UPLOAD`), returning HTTP 429 with `Retry-After` header.
    - Creates `ProjectImage` in state `UPLOADED` and enqueues job to BullMQ `image-analysis-queue` (updating state to `QUEUED`).
    - Writes `IMAGE_UPLOADED` event to `AuditLog`.
  - `GET /api/v1/projects/[id]/images`: Lists all active images for a project with analysis results.
  - `GET /api/v1/projects/[id]/images/[imageId]`: Returns image record with short-lived read SAS URL.
  - `DELETE /api/v1/projects/[id]/images/[imageId]`: Soft-deletes `ProjectImage` by updating `processingState = DELETED` and logs `IMAGE_DELETED` audit event.
- UI:
  - `src/components/images/ImageUploadZone.tsx`: Client-side drag-and-drop zone with MIME and size pre-validation, progress states, and daily limit messaging.

### 2. Asynchronous Gemini Vision Worker (`REQ-06`, `REQ-16`)
- `src/lib/vision/gemini-client.ts`:
  - `GeminiAnalysisClient`: Queries Gemini API using `IMAGE_ANALYSIS_MODEL` (`gemini-1.5-pro`) and `GEMINI_API_KEY`.
  - Enforces structured JSON output schema: `spaceType`, `isInterior`, `facadeType`, `floorCount`, `architecturalStyle`, `visibleSurfaces`, `naturalLightQuality`, `paintableRegions`, and confidence scores.
  - Robust error classification:
    - Safety refusals (`finishReason === 'SAFETY'` or blocked prompts) throw `GeminiSafetyRefusalError`.
    - Transient HTTP (429, 5xx) and network errors throw `GeminiRetryableError`.
- `src/workers/analysis-worker.ts`:
  - Consumes jobs from `image-analysis-queue`.
  - Transitions `ProjectImage.processingState` to `PROCESSING`.
  - On success: Creates `ImageAnalysisResult` with `analysisState = AI_INFERRED` and sets `ProjectImage.processingState = COMPLETED`.
  - Strict 1:1 foreign key relation: `ImageAnalysisResult.projectImageId` uniquely and non-nullably references `ProjectImage.id`.
  - Safety Refusal: Immediately marks `ProjectImage.processingState = FAILED` without BullMQ retries, stores `safetyRefusalReason`, and records `SAFETY_REFUSAL` event in `AuditLog`.
  - Retries: Up to 3 attempts with exponential backoff before transitioning to `FAILED`.
  - Queue Discipline: Zero references to visualization queues or image generation jobs.

---

## Verification & Test Results
- **Unit & Integration Tests**:
  - `tests/images/upload.test.ts`: 8/8 tests passing (valid JPEG/PNG/WebP, invalid MIME rejection, spoofed magic byte rejection, oversized file rejection, filename sanitization).
  - `tests/vision/gemini-analysis.test.ts`: 5/5 tests passing (1:1 strict foreign key relation, safety refusal zero-retry transition, retry exponential backoff, retry exhaustion, queue discipline invariant).
  - Full test suite: **56/56 tests passing** across 11 test files.
- **Type Checking & Production Build**:
  - `tsc --noEmit`: 0 errors.
  - `next build`: Successfully compiled all static and dynamic routes.
