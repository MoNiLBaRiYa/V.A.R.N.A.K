---
phase: 01-foundation
plan: "04"
subsystem: auth
tags: [next-auth, entra-id, oidc, security-invariants, audit-log, session-protection]

requires:
  - phase: 01-foundation (01-01, 01-02, 01-03)
    provides: Toolchain, Prisma models, AuditLog persistence
provides:
  - Auth.js v5 OIDC integration with Microsoft Entra External ID as sole identity authority (src/lib/auth/config.ts, src/lib/auth/auth.ts)
  - Next.js route handler for Auth.js endpoints (src/app/api/auth/[...nextauth]/route.ts)
  - Protected /api/v1/* route middleware returning HTTP 401 for unauthenticated requests (src/middleware/auth.ts)
  - Post-login callback handler executing User upsert and AuditLog events (src/lib/auth/callbacks.ts)
  - Architectural invariant test suite ensuring zero local password fields and sole Entra authority (tests/auth/auth-invariant.test.ts)
  - Unit tests for session middleware and user upsert (tests/auth/auth.test.ts)
affects: [all phases]

tech-stack:
  added: [next-auth@5.0-beta]
  patterns: [OIDC delegation to Microsoft Entra External ID, Zero local credential storage, JWT session cookies, Invariant CI tests]

key-files:
  created:
    - src/lib/auth/config.ts
    - src/lib/auth/auth.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/middleware/auth.ts
    - src/lib/auth/callbacks.ts
    - tests/auth/auth-invariant.test.ts
    - tests/auth/auth.test.ts

key-decisions:
  - "DEC-02 / Task 0.5: Microsoft Entra External ID is the sole identity authority. Zero password hashes or local credential fields exist."
  - "Next.js App Router route conformance: Exported auth helpers from src/lib/auth/auth.ts and restricted src/app/api/auth/[...nextauth]/route.ts to HTTP methods (GET, POST)."
  - "Task 0.5.3: Implemented session validation middleware protecting /api/v1/* with 401 responses."
  - "Task 0.5.4: Post-login callback automatically upserts User record and writes LOGIN / REGISTRATION audit events."

requirements-completed: [REQ-01, REQ-16, REQ-18]

duration: 20m
completed: 2026-09-25
---

# Phase 01: Plan 04 (Authentication Foundation & Security Invariants) Summary

**Configured Microsoft Entra External ID as sole identity authority via Auth.js v5, implemented `/api/v1/*` session protection middleware, post-login User upsert and audit logging, and enforced architectural security invariant tests.**

## Performance

- **Duration:** 20m
- **Tasks:** 3 completed
- **Files modified:** 7 files

## Accomplishments

- Configured Auth.js v5 with Microsoft Entra External ID OIDC provider in `src/lib/auth/config.ts` and `src/lib/auth/auth.ts`.
- Exposed standard Auth.js endpoints via `src/app/api/auth/[...nextauth]/route.ts` with strict App Router route compliance.
- Implemented `/api/v1/*` route protection in `src/middleware/auth.ts` returning 401 Unauthorized for missing or expired sessions.
- Created `src/lib/auth/callbacks.ts` syncing external subject IDs to internal `User` records and recording `LOGIN` / `REGISTRATION` audit logs.
- Enforced DEC-02 architectural invariants in `tests/auth/auth-invariant.test.ts`:
  - Verified 0 password, hash, salt, or TOTP fields in Prisma `User` and `UserProfile` tables.
  - Verified no custom credential or registration endpoints exist in `/api/auth/*`.
  - Verified Microsoft Entra External ID is configured as sole identity provider.
- Verified all auth unit and integration tests in `tests/auth/auth.test.ts` pass cleanly.
