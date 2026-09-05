# ScienceFit — Production Final Verification

Date: 2026-09-05 (UTC)
Scope: read-only verification + smallest safe code fix. No API-key migration performed. No destructive DB change performed.

---

## FINAL STATUS: READY FOR PRODUCTION (with one environment prerequisite)

The single prerequisite is listed under **ENVIRONMENT CONFIGURATION REQUIRED**. No database change is required.

---

## 1. Supabase server secret — findings

Inspected: `src/integrations/supabase/client.server.ts`, `src/integrations/supabase/auth-middleware.ts`,
`src/integrations/supabase/client.ts`, and all seven modules importing `supabaseAdmin`.

| Question | Answer |
| --- | --- |
| A. Variable name the code expects | `SUPABASE_SERVICE_ROLE_KEY` (server-side `process.env`, read **inside** `createSupabaseAdminClient()`, never at module scope). `SUPABASE_URL` is the companion variable. |
| B. Accepts legacy `service_role` JWT? | Yes. A legacy `eyJ...` JWT is passed as both `apikey` and the default `Authorization: Bearer`, which is the correct legacy shape. |
| C. Safe with a modern `sb_secret_...` value? | Yes, with **no code change**. `createSupabaseFetch()` detects the `sb_secret_` / `sb_publishable_` prefix and *deletes* the `Authorization: Bearer <opaque key>` header, sending only `apikey: <key>`. This is exactly the handling opaque keys require, and avoids the `Expected 3 parts in JWT; got 1` failure. |
| D. Would renaming the variable require code changes? | Yes — three references (`client.server.ts` lines 37, 42, 51). **Recommendation: do not rename.** Keep `SUPABASE_SERVICE_ROLE_KEY` as the variable *name* and, if desired, put a modern `sb_secret_...` *value* in it. Name and key format are independent. |
| E. Does any server client accidentally receive the user's session token? | **No.** Two independent clients exist: the admin client (`client.server.ts`) constructs its own `fetch`, never reads the incoming request, and sets no user `Authorization`; the request-scoped client (`auth-middleware.ts`) uses the **publishable** key plus the verified caller bearer, so RLS applies as that user. Sign-in never happens on the admin client. |

Secret hygiene confirmed: server-only, no `VITE_` prefix, not hardcoded, never logged (error paths log only the *variable name*), never returned to the browser, and absent from the committed `.env` (which holds only URL / project id / publishable key).

## 2. `supabaseAdmin` / key usage inventory

Search terms: `supabaseAdmin`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY(S)`, `createClient(`, `service_role`, `sb_secret_`.

| File | Occurrence | Elevated privileges genuinely required? |
| --- | --- | --- |
| `src/integrations/supabase/client.server.ts` | Defines admin client, reads `SUPABASE_SERVICE_ROLE_KEY`, `createClient(` | Yes — this is the definition site. Lazily constructed via Proxy. |
| `src/integrations/supabase/auth-middleware.ts` | `createClient(` + `sb_secret_` prefix test | No service role used — publishable key + caller bearer. Correct. |
| `src/integrations/supabase/client.ts` | `createClient(` (browser) | No — publishable key only. Correct. |
| `src/lib/flow.server.ts` | `admin()` helper | **Yes, partially.** Required for: cross-actor writes (challenge creation, coach invitation fan-out, lock + anonymise + queue, ranking writes, engine-result ingestion) and for the anonymised athlete brief projection, all of which are deliberately not grantable to any single caller. Role checks were already refactored to the **user** client. |
| `src/lib/app.server.ts` | `admin()` helper | Mixed. Required for aggregate/cross-tenant dashboard counts; caller identity is verified first by `requireSupabaseAuth`. |
| `src/lib/marketplace.server.ts` | `admin()` helper | Yes for gate-enforced writes (hires, conversations) where the row spans two actors; gating thresholds (60/70/75) are checked in code before any elevated write. |
| `src/lib/notifications.server.ts` | `admin()` helper | Yes — notifications are written *for another user*; RLS intentionally denies `INSERT` to end users. |
| `src/lib/profile.server.ts` | `admin()` helper | Partially. Used for role/state transitions the user may not self-grant. Ordinary profile reads/writes are already user-client. |
| `src/lib/performance.server.ts` | `admin()` helper | Yes — `coach_performance_scores` is deny-all for `INSERT`/`UPDATE` by policy; only derived server computation may write it. |

No occurrence of `SUPABASE_SECRET_KEY`, `SUPABASE_SECRET_KEYS`, or a hardcoded `sb_secret_` literal anywhere in the repository.

Every `supabaseAdmin` import is a **dynamic** `await import(...)` inside a handler, so the server-only module never enters a client bundle.

## 3. Challenge visibility — traced path

`src/routes/_authenticated/app.challenges.$challengeId.index.tsx`
→ `ChallengeDetailScreen`
→ `getChallenge` (`src/lib/flow.functions.ts:61`, `createServerFn({method:"POST"}).middleware([requireSupabaseAuth])`)
→ `loadChallenge(context.supabase, context.userId, challengeId)` (`src/lib/flow.server.ts:238`)

Per-query client, verified line by line:

| Query | Table | Client |
| --- | --- | --- |
| challenge row by id | `challenges` | **A — authenticated user client** (RLS applies) |
| training brief projection | `athlete_requests` (7 non-identifying columns only) | **B — admin client**, deliberate: preserves athlete anonymity without granting coaches row access to the request table |
| caller's coach row | `coaches` | **A — authenticated user client** |
| caller's own program tree | `programs` + weeks/days/exercises | **A — authenticated user client** |
| submission count (head/exact) | `programs` | **B — admin client**, count only, no rows returned — preserves submission secrecy |

The two clients are not mixed or reused; the admin client is fetched via the local `admin()` helper and is never handed the caller's token.

## 4. Database schema — verified against the live database

All tables and columns exist as required: `challenges.id`, `challenge_coach_matches.challenge_id`,
`challenge_coach_matches.coach_id`, `coaches.id`, `coaches.user_id`.

- RLS enabled: `challenges` ✔, `challenge_coach_matches` ✔, `coaches` ✔
- Grants present for `authenticated` and `service_role` on all three (SELECT/INSERT/UPDATE verified via `has_table_privilege`).
- Foreign keys present: `challenge_coach_matches.challenge_id → challenges.id`, `challenge_coach_matches.coach_id → coaches.id`, `challenges.athlete_id → athletes.id`, `challenges.request_id → athlete_requests.id`, `coaches.user_id → auth.users.id`.

## 5. RLS migration — NOT REQUIRED

The proposed coach-visibility policy would have been a **duplicate**. The existing `challenges_visible`
SELECT policy (role `authenticated`) already reads:

```
athlete owns the challenge
OR EXISTS (challenge_coach_matches m JOIN coaches c ON c.id = m.coach_id
           WHERE m.challenge_id = challenges.id AND c.user_id = auth.uid())
OR private.has_role(auth.uid(), 'admin')
```

That is exactly "only coaches actually matched to the challenge", least privilege, `authenticated` only,
athlete access preserved. `challenge_coach_matches.matches_visible` mirrors it. **No migration was created.**

---

## CODE FIXED

1. `src/routes/auth.tsx` — `validateSearch` now uses `z.object({ redirect: z.string().optional() })`.
   Previously the hand-written validator produced a **required** `redirect` search key, which made every
   `Link`/`navigate` to `/auth` a type error (5 errors across `AppShell`, `SettingsScreen`, `index`, `reset-password`).
   Behaviour is unchanged at runtime; the deep-link preservation still works.
2. Repo-wide Prettier formatting applied to satisfy the project's own `prettier/prettier` lint rule
   (1113 auto-fixable errors cleared). No logic touched.

## DATABASE CHANGE REQUIRED

**None.** Schema, grants, RLS and policies are correct as deployed.

## ENVIRONMENT CONFIGURATION REQUIRED

Exactly one server-side variable must exist in the deployment environment (in addition to the already-present
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`):

```
SUPABASE_SERVICE_ROLE_KEY
```

- Keep this **name** for this stabilization step — renaming it requires editing three lines of generated code.
- The **value** may be either the legacy `service_role` JWT or a modern `sb_secret_...` key; the existing fetch
  shim handles both correctly.
- Never add a `VITE_` counterpart. Never place it in a committed file.

## VALIDATION RESULTS

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `bunx tsgo --noEmit` (project's TS checker) | **PASS — 0 errors** |
| Lint | `bun run lint` | 0 errors in authored code; 20 `react-refresh` warnings (shadcn/ui convention). 1 remaining `prefer-const` error is inside the auto-generated, non-editable `src/integrations/supabase/previewAuthStorage.ts`. |
| Build | `bun run build` | **PASS** — client + server bundles emitted, worker config generated |
| Dev server | running on :8080 | **PASS** |

Functional walkthrough (headless Chromium, real signed-in session):

| # | Flow | Result |
| --- | --- | --- |
| 1 | Login / session restore | PASS — authenticated shell renders, no redirect loop |
| 2 | Athlete Dashboard | PASS (renders; account under test has no athlete data) |
| 3 | Coach Dashboard | PASS — Available Challenges, My Programs, Pending Reviews, Performance Score all render |
| 4 | Challenge list | PASS — empty-state renders ("No open invitations right now") |
| 5 | Open Challenge | NOT EXERCISED — no challenge rows exist for the test account |
| 6 | Challenge Details | NOT EXERCISED — same reason |
| 7 | Program Builder | NOT EXERCISED — requires an open challenge |
| 8 | Challenge Submission | NOT EXERCISED — requires an open challenge |
| 9 | Challenge Results | NOT EXERCISED — requires a completed evaluation |
| 10 | Ranking | PASS — page renders |
| 11 | Marketplace | PASS — renders with Performance Score gating copy |
| — | Notifications / Profile / Settings / Request Wizard | PASS |

Rows 5–9 are **not** claimed as verified. They are data-dependent flows and the verification account has no
challenge records; the code path was verified by static trace (section 3) but not executed end to end.

Known non-blocking console noise: a nested `<li>` hydration warning originating from the sidebar menu markup,
and one React "state update before mount" warning. Cosmetic; no functional impact.
