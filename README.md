# ScienceFit MVP

You are the principal full-stack engineer for ScienceFit. Build the complete ScienceFit MVP as a production-ready full-stack application. You have access to six governance documents uploaded to this conversation: **ARCHITECTURE.md**, **PRODUCT_BIBLE.md**, **BUSINESS_PROTOCOL.md**, **AI_EVALUATION_ENGINE.md**, **ENGINEERING_PRINCIPLES.md**, and **DESIGN_CONSTITUTION.md**. These six documents are the single source of truth. Read them in their entirety before writing any code.

**DOCUMENT PRIORITY HIERARCHY** (resolve conflicts in this order):

Architecture > Engineering Principles > AI Evaluation Engine > Business Protocol > Product Bible > Design Constitution.

**CORE RULES**:

1. Never invent requirements, business rules, AI formulas, database tables, API endpoints, colors, typography, evaluation dimensions, marketplace rules, or authentication flows not explicitly present in the governance documents.

2. If a requirement is missing or ambiguous, leave a clear `// TODO: Governance gap - [description] - requires clarification` instead of hallucinating.

3. Build exactly what is specified. No more, no less.

**TECH STACK** (Strict — use exactly as specified in Architecture and Engineering Principles):

- **Frontend**: React 18+ (TypeScript, `strict: true`), Vite, Tailwind CSS, shadcn/ui components

- **Backend**: Fastify 4.x (Node.js 20 LTS, TypeScript) — NOT Express or NestJS

- **Database**: PostgreSQL 15+

- **ORM**: Prisma 5.x

- **Auth**: Clerk (OAuth 2.0 + PKCE, JWT access tokens 15min TTL, refresh tokens 7day TTL, WebAuthn for admin/medical reviewer roles)

- **Cache / Queue / Session**: Redis 7+ Cluster with BullMQ

- **API Gateway**: Kong (rate limiting, versioning, WAF, TLS 1.3 termination)

- **Object Storage**: Cloudflare R2 (zero egress fees)

- **Real-time**: Server-Sent Events (SSE)

- **Validation**: Zod at API gateway AND at every module boundary

- **State Management**: Zustand (global UI state), TanStack Query (server state)

- **Testing**: Vitest

- **Container**: Docker + Docker Compose

**MODULE ARCHITECTURE** (Build as Modular Monolith — single deployable unit with strict internal boundaries):

Implement these 11 modules, each owning its database tables, business logic, repository layer, and public API interface. No circular dependencies. Cross-module reads only via public repository interfaces. Cross-module writes only via async events (BullMQ internal event bus).

1. **Users Module**: Owns `users`, `user_profiles`, `user_preferences`. Handles profile CRUD.

2. **Auth Module**: Owns `auth_credentials`, `auth_sessions`, `auth_oauth_connections`. Handles login, logout, token management.

3. **Athletes Module**: Owns `athletes`, `workout_logs`. Handles streaks, adherence, sync endpoint (`POST /v1/athletes/sync`), leaderboard.

4. **Coaches Module**: Owns `coaches`, `coach_performance_scores`. Handles verification flow, performance score visibility, leaderboard.

5. **Challenges Module**: Owns `challenges`, `challenge_coach_matches`. Handles matching, lifecycle, deadlines.

6. **Programs Module**: Owns `programs`, `program_weeks`, `program_days`, `program_exercises`. Handles CRUD, versioning, locking.

7. **Evaluation Module**: Owns `evaluations`, `evaluation_results`. Orchestrates AI job queue, human escalation queues.

8. **Marketplace Module**: Owns `marketplace_listings`, `marketplace_bookings`. Handles listings, bookings, payments.

9. **Billing Module**: Owns `subscriptions`, `payments`. Handles subscriptions, invoicing, payouts.

10. **Notifications Module**: Owns `notifications`, `notification_preferences`. Handles multi-channel delivery, preferences, rate limits.

11. **Analytics Module**: Owns `events` (partitioned), `audit_logs`. Handles dashboards, exports.

**DATABASE RULES**:

- PostgreSQL is the sole source of truth. Redis is cache/queue only. No business state in Redis.

- Each module owns its schema. No shared tables between modules.

- Audit triggers on all tables. Soft deletes enforce data retention.

- Partitioned tables: `events`, `workout_logs`, `audit_logs`.

- GIN indexes on JSONB. BRIN on time-series data.

- Use Prisma for all database access. No raw SQL unless explicitly justified.

**API ARCHITECTURE**:

- All backend capabilities exposed through versioned REST API (`/v1/`).

- OpenAPI-first: Define schemas before implementation; contract tests enforce compliance.

- Request validation via Zod at Kong gateway AND at every module boundary.

- Rate limits: 100 req/min anonymous, 1000 req/min authenticated.

- TLS 1.3 termination at Kong.

- SSE endpoints for real-time notifications and presence updates.

- Frontend never touches the database directly.

**AUTHENTICATION & AUTHORIZATION**:

- Clerk for authentication. OAuth 2.0 + PKCE (Google, Apple).

- JWT access tokens (15 min TTL), refresh tokens (7 day TTL).

- RBAC roles: `athlete`, `coach`, `admin`, `organization`, `medical_reviewer`.

- Resource-level permissions (e.g., coach can only edit OWN programs).

- Attribute-based permissions (e.g., medical reviewers only see L3/L4 escalations).

- Session binding to device fingerprint.

**BUSINESS LOGIC** (Implement exactly per Business Protocol):

- **Athlete Lifecycle**: `UNREGISTERED` → `REGISTERED` → `ACTIVE` → `REQUEST_PENDING` → `VALID` → `CHALLENGE_ACTIVE` → `PROGRAM_DELIVERED` → `IN_PROGRESS` → `COMPLETED` → `(Optional) PRIVATE_CLIENT` → `ACTIVE`.

- **Coach Lifecycle**: `UNREGISTERED` → `PENDING_VERIFICATION` → `VERIFIED` → `QUALIFIED` → `ACTIVE` → `PROGRAMMING` → `SUBMITTED` → `EVALUATION_PENDING` → `RESULTS_RECEIVED` → `ACTIVE` / `MARKETPLACE_ELIGIBLE` → `PRIVATE_CLIENT_ACTIVE` → `ACTIVE`.

- **Request Lifecycle**: Implement all 10 steps exactly: Athlete Creates Request → AI Validates Request → Challenge Creation → Coach Invitation → Program Development → Submission Lock → AI Evaluation → Ranking → Delivery → Coach Update.

- **Challenge States**: `DRAFT` → `PUBLISHED` → `ACTIVE` → `LOCKED` → `EVALUATING` → `COMPLETED` → `ARCHIVED`.

- **Challenge Rules**: One Request generates exactly One Challenge. One Submission Per Coach. Deadline enforcement (immutable). Submission secrecy (encrypted at rest). Equal evaluation criteria. Original work only. Safety first.

- **Tie-Breaker Rules**: 1) Higher Safety score wins, 2) Higher Personalization score wins, 3) Earlier submission timestamp wins, 4) Co-winners if still tied.

- **Marketplace Gating**: Browse coaches (Performance Score ≥60), Message coach (≥70), Hire coach (≥75 + marketplace enabled + payment method on file).

- **Performance Score Tiers**: Novice (0–59), Developing (60–69), Proficient (70–79), Expert (80–89), Master (90–100).

- **Anti-Abuse**: Implement detection and enforcement for duplicate submissions, plagiarism, unsafe programming, coordinate manipulation, account farming, harassment, data misuse. Use graduated sanctions per Business Protocol Section 16.

**AI EVALUATION ENGINE** (Placeholder / Integration Only — DO NOT FAKE AI):

- Do NOT implement fake scoring algorithms or hardcoded scores.

- Build the exact interfaces, database schema, API endpoints, queue workers, and UI components that will integrate with the real SEEv2 engine.

- The 7 evaluation dimensions with exact weights: **Safety (1.5×)**, **Goal Alignment (1.2×)**, **Personalization (1.0×)**, **Programming Quality (1.0×)**, **Scientific Consistency (1.0×)**, **Practicality (0.8×)**, **Communication Quality (0.8×)**.

- Each dimension produces: Score (0–100), Confidence (0–1), Reasoning (structured text with specific program attributions).

- **Human Oversight Escalation**: L1 Auto-Reject (Safety <30, immediate), L2 Admin Alert (Safety 30–50, ≤2hr), L3 Expert Review (Elite/Rehab/Complex, ≤24hr), L4 Medical Review (Clinical population, ≤48hr), L5 Dispute Resolution (Appeal/Complaint/Anomaly, ≤72hr).

- **Anonymity enforcement**: Coach metadata cryptographically stripped before evaluation. Coach ID replaced with anonymous hash (salted, per-challenge). Reverse lookup impossible without challenge-scoped key.

- **Criteria versioning**: Active challenges pinned to criteria version at open date. Historical evaluations immutable. Never retroactively recalculate.

**DESIGN SYSTEM** (Strict adherence to Design Constitution):

- **Color Palette** (exact hex tokens):

  - Obsidian Black `#030303` — primary background. NEVER use pure black `#000000`.

  - Champagne Gold `#D4AF37` — primary accent, CTAs, highlights, map lines.

  - Warm White `#F5F5F0` — primary typography. NEVER use pure white `#FFFFFF`.

  - Electric Lime `#7FFF00` — success accent, confirmed AI decisions. Use sparingly.

  - Soft Cyan `#40E0D0` — information accent, scientific visualization. Use sparingly.

  - Muted Gold `#B8941F` — secondary accent, hover states.

  - Deep Charcoal `#1A1A1A` — card backgrounds, elevated surfaces.

  - Warm Gray `#8A8A80` — secondary text, captions.

- **Typography**:

  - Headlines: Inter or SF Pro Display (weights 300, 400, 600).

  - Body: Inter (weights 400, 500).

  - Data / Monospace: JetBrains Mono or SF Mono (weights 400, 500).

  - Max 2 font families per screen. System font fallback. `font-display: swap`.

- **Dark theme only**. No competing accent colors against Champagne Gold.

- **Glass effects** for elevated surfaces (cards, modals, panels) using Deep Charcoal with subtle transparency and borders.

- Contrast minimum WCAG 2.1 AA.

**RESPONSIVE & DEVICE TIER STRATEGY**:

- Mobile-first (320px base).

- Breakpoints: Mobile `<768px`, Tablet `768–1024px`, Desktop `1024–1440px`, Wide `>1440px`.

- Implement Tier A/B/C adaptive rendering:

  - **Tier A** (high-end): Full 3D world map, GSAP scroll animations, AVIF images, uncompressed JSON, 60fps.

  - **Tier B** (mid-range): Simplified 3D, reduced particles, WebP images, Gzip JSON, 30–60fps.

  - **Tier C** (entry-level): Static map images, CSS animations only, JPEG 80% max 800px, Brotli + MessagePack, minimal JS, 30fps minimum.

- Tier detection via `navigator.hardwareConcurrency`, `navigator.deviceMemory`, WebGL support checks, `navigator.connection.effectiveType`. Respect `prefers-reduced-motion`.

**SCROLL FILM & MOTION** (Design Constitution):

- Cinematic scroll experience. Scroll position directly maps to animation timeline (scrubbing). No autoplay.

- Full viewport chapters (100vh minimum). No traditional header navigation during landing scroll film.

- Smooth scroll required (Lenis or equivalent).

- Pinned sections for key chapters.

- Transition types: Morph, Dissolve, Particle Flow, Scale Shift, Color Transition.

- Easing: `power2.out` (entrance), `power2.inOut` (transitions), `none` (scroll scrub).

- Ambient effects: World map slow rotation (0.1°/sec), city pulses (4s cycle), particle drift, connection signals between cities.

- All animations must be purpose-driven. Honor `prefers-reduced-motion` with static fallbacks.

**OFFLINE-FIRST & SYNC**:

- Core functionality works without internet.

- `POST /v1/athletes/sync` endpoint with sync tokens (`last_sync_at`).

- Conflict resolution rules: Server-wins for business logic (workout logs same day, program adherence, notifications), Client-wins for athlete preferences (athlete notes, notification read status).

- Tier-based payload adaptation: Tier C receives Brotli + MessagePack compressed responses.

- Background sync for workout logs and preferences.

- Previously downloaded programs and workout logs accessible offline.

**PERFORMANCE BUDGETS**:

- Tier A: JS initial 200KB gzipped, CSS 50KB, Images AVIF/2× retina.

- Tier B: JS 150KB, CSS 40KB, Images WebP/1.5×.

- Tier C: JS 100KB, CSS 30KB, Images JPEG 80% 800px max.

- FCP: `<1.0s` (A), `<1.5s` (B), `<2.5s` (C).

- LCP: `<1.5s` (A), `<2.5s` (B), `<4.0s` (C).

**SECURITY** (Defense in Depth):

- **Layer 1 (Edge)**: Cloudflare DDoS mitigation, WAF, bot detection, TLS 1.3.

- **Layer 2 (Gateway)**: Kong rate limiting, API key validation, request size limits (10MB max), IP allowlisting for admin endpoints.

- **Layer 3 (Auth)**: Clerk OAuth 2.0 + PKCE, WebAuthn for admin/medical reviewers.

- **Layer 4 (Authorization)**: RBAC with resource-level and attribute-based permissions.

- **Layer 5 (Application)**: Zod input validation on every endpoint, Prisma parameterized queries (no SQL injection), CSP headers, XSS prevention, CSRF tokens for state-changing operations.

- **Layer 6 (Data)**: AES-256 encryption at rest, TLS 1.3 in transit, field-level encryption for PII, Argon2id for token hashing.

- **Layer 7 (AI)**: Prompt injection detection, output schema validation (Zod), anonymity enforcement, human oversight for safety-critical decisions.

**FEATURE IMPLEMENTATION CHECKLIST** (Build all):

- [ ] Complete frontend (React + Vite + Tailwind + shadcn/ui)

- [ ] Complete backend (Fastify modular monolith with 11 modules)

- [ ] Authentication (Clerk integration with all OAuth flows, JWT, WebAuthn for admin)

- [ ] Database (PostgreSQL with Prisma, all 11 module schemas, partitioned tables, audit triggers)

- [ ] Dashboard (Analytics module with North Star metrics placeholders per Product Bible Section 12)

- [ ] Coach Dashboard (submissions, feedback, performance score history, leaderboard, verification status)

- [ ] Athlete Dashboard (requests, active programs, progress tracking, sync, workout logs)

- [ ] Admin Dashboard (user management, dispute resolution, criteria approval, audit logs, human oversight queues)

- [ ] AI Evaluation Integration Placeholder (job queue, score cards, reasoning display, human escalation UI, anonymization layer)

- [ ] Marketplace (coach listings, reputation-gated browsing/messaging/hiring, booking flow, payments)

- [ ] Challenge System (creation, coach matching, submission, cryptographic locking, deadline management)

- [ ] Notification System (multi-channel delivery, preferences, SSE real-time updates)

- [ ] Responsive UI (mobile-first, all breakpoints, Tier A/B/C adaptive rendering)

- [ ] Accessibility (WCAG 2.1 AA, semantic HTML, keyboard navigation, screen reader support, reduced motion, focus indicators, touch targets 44×44px)

- [ ] API Layer (versioned REST `/v1/`, Zod validation, OpenAPI specs, SSE endpoints)

- [ ] Error Handling (structured error codes with `request_id`, severity levels, user-friendly messages, docs URLs)

- [ ] Offline Support (service worker, sync API, conflict resolution, local IndexedDB cache)

- [ ] Theme (Dark mode only, exact color tokens from Design Constitution, glass effects)

- [ ] Design System (component library aligned with atoms/molecules/organisms/templates hierarchy)

- [ ] Navigation (scroll film cinematic experience for landing, app navigation for dashboard areas)

- [ ] Forms (athlete request wizard with auto-save, profile completion, program submission with validation)

- [ ] Landing Pages (Hero, Athlete, Challenge, Competition, Evaluation, Winner, Reputation, Dashboard Preview chapters)

- [ ] Profile Pages (athlete profile, coach profile with verification status and specializations)

- [ ] Settings (preferences, notifications, account, security, device tier selection)

- [ ] Analytics Placeholders (event tracking, audit logs, metric dashboards per Product Bible Section 12)

**ANTI-HALLUCINATION MANDATES**:

Before implementing any feature, verify it exists in the governance documents. Specifically:

1. Never invent business rules. Use Business Protocol exactly.

2. Never invent AI formulas. Use AI Evaluation Engine exactly. Only build integration placeholders for the actual scoring engine.

3. Never invent database tables. Use Architecture Section 4.1 exactly.

4. Never invent API endpoints. Use Architecture data flows and Business Protocol lifecycles.

5. Never invent colors. Use Design Constitution Section 3 exactly.

6. Never invent typography. Use Design Constitution Section 4 exactly.

7. Never invent evaluation dimensions. Use AI Evaluation Engine Section 8 exactly (7 dimensions with specified weights).

8. Never invent marketplace rules. Use Business Protocol Section 13 exactly.

9. Never invent authentication flow. Use Architecture Section 13 and Business Protocol Section 4 exactly.

10. Never invent Performance Score calculation. Use AI Evaluation Engine Section 12 and Business Protocol Section 11 exactly.

11. Never invent challenge rules. Use Business Protocol Section 12 exactly.

If any implementation detail is missing from all six documents, insert a TODO comment with the exact format: `// TODO: Governance gap - [description] - requires clarification from [relevant team, e.g., Principal Backend Architect / Product Team]`.

Start by scaffolding the monorepo with strict module boundaries, then implement the Prisma database schema for all 11 modules, then the Fastify backend with Zod validation and BullMQ event bus, then the React frontend with the Design Constitution theme system, then wire all business workflows per the Business Protocol.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sciencefit-athlete-coach-ai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9c2eb813-ee06-49a5-b9dc-8dcb7efcc306).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
