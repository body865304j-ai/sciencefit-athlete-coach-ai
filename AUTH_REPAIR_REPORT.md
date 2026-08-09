# AUTH_REPAIR_REPORT.md

**AUTH STATUS: 🟡 WORKING WITH CONDITIONS**
(Code path fully validated end-to-end. The one remaining condition is a product decision: email confirmation is required before a new account can sign in.)

## 1. Root cause

Authentication was never technically broken at the provider level — the failure was in the **post-authentication client flow**, in two places:

1. **Successful sign-in dropped the user on the marketing landing page.** `/auth` redirected authenticated users to `/` instead of `/app`. Users signed in, saw the scroll-film landing page, and reasonably concluded login had failed. Deep links to protected routes were also lost (`/app/settings` → `/auth` → `/`).
2. **Sign-up appeared to do nothing.** Email confirmation is enabled on the project, so `signUp()` returns `session === null`. The old page communicated this with a single transient toast and then re-rendered the same empty form — indistinguishable from a failure. There was also no way to resend the confirmation email.

Secondary defects (all fixed): raw provider error strings shown to users (including breach-check and credential wording), no inline error region, no loading state while the session was being probed (form flashed for already-signed-in users), and no `redirect` preservation through the auth gate.

## 2. Files inspected

- `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/app.tsx`, `src/routes/_authenticated/app.index.tsx`, `src/routes/index.tsx`, `src/routes/__root.tsx`
- `src/hooks/useSession.ts`, `src/components/app/AppShell.tsx`
- `src/start.ts`, `src/router.tsx`
- `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`
- `src/lib/queries.ts`, `src/lib/app.functions.ts`, `src/lib/flow.functions.ts`, `src/lib/flow.server.ts`
- `.env`, database triggers/functions (`handle_new_user`, `has_role`), RLS policy set

## 3. Files modified

- `src/routes/auth.tsx` — rewritten UX/state machine (no architecture change)
- `src/routes/_authenticated/route.tsx` — gate now preserves the intended destination
- `src/lib/auth-errors.ts` — **new**: user-safe error mapping + same-origin redirect validation

## 4. Problems discovered

| # | Problem | Severity |
|---|---------|----------|
| 1 | Post-login redirect to `/` instead of `/app` | Critical (perceived login failure) |
| 2 | Sign-up "confirm your email" state invisible (toast only) | Critical |
| 3 | No resend-confirmation path | High |
| 4 | Raw provider error text shown to users | High (UX + info disclosure) |
| 5 | Intended destination lost on the auth redirect | Medium |
| 6 | Auth form flashed before the session probe resolved | Medium |
| 7 | Validation errors only as toasts, no `role="alert"` region | Medium (a11y) |

Not a problem (verified working, left untouched): session persistence in `localStorage`, bearer attachment via `attachSupabaseAuth` in `src/start.ts`, `requireSupabaseAuth` server middleware, the `_authenticated` `ssr: false` gate, `handle_new_user` profile trigger, sign-out cache teardown in `AppShell`.

## 5. Fixes implemented

- Authenticated users on `/auth` now navigate to `?redirect=` (validated same-origin, non-`/auth`) or `/app`.
- The unauthenticated gate throws `redirect({ to: "/auth", search: { redirect: location.href } })`.
- Sign-up without a session renders a dedicated **Confirm your email** screen naming the address, with a **Resend confirmation email** action (`supabase.auth.resend`).
- All provider errors pass through `authErrorMessage()`: friendly copy for invalid credentials, unconfirmed email, existing account, breached/weak password, invalid email, rate limits, network failures, expired session; everything else falls back to a generic message (no provider internals leaked).
- Inline `role="alert"` error region replaces toast-only feedback; password guidance shown in sign-up mode.
- "Checking your session…" state while the session probe is in flight — the form no longer flashes and there is no loading loop.
- Open redirect prevented by `safeRedirect()` (rejects absolute URLs, protocol-relative `//`, and `/auth*`).

## 6. Security issues discovered

None critical. Verified during the audit:

- No service-role key in any client-reachable module; `client.server.ts` is only loaded inside server handlers.
- `.env` exposes only the publishable key and URL (safe by design).
- Roles are read server-side from `user_roles` under RLS — never trusted from the client.
- Every app data call goes through `createServerFn` + `requireSupabaseAuth`; no direct table access from the browser.
- Added: redirect-target validation (prevents open redirect via `?redirect=`), and error messages no longer distinguish "no such user" from "wrong password".
- Leaked-password protection (HIBP) is **enabled** — a real signup with a breached password is correctly rejected (now with readable copy).

## 7. Database / RLS changes

**None.** No migration was required; no schema, policy, grant, or trigger was touched.

## 8. Authentication flow after repair

```
/app/settings (signed out)
  → _authenticated gate: supabase.auth.getUser() → no user
  → /auth?redirect=/app/settings
  → sign in (password) → Supabase session → localStorage
  → onAuthStateChange → root router.invalidate()
  → /auth effect → navigate(/app/settings, replace)
  → gate re-runs, getUser() OK
  → AppShell → viewerQuery (serverFn + bearer) → profile/roles → screen

Sign-up → session null → "Confirm your email" screen (+ resend)
       → user clicks emailed link → /auth → sign in → as above

Sign out → cancelQueries → cache clear → supabase.auth.signOut()
        → navigate(/auth, replace); tokens removed from localStorage
```

## 9. Validation results

Typecheck `bunx tsgo --noEmit`: **0 errors**. Build `bun run build`: **success** (client + SSR worker). ESLint on changed files: **clean**.

Headless Chromium against the running app:

| Flow | Result |
|---|---|
| 1. Open `/app/settings` unauthenticated | ✅ → `/auth?redirect=%2Fapp%2Fsettings` |
| 2. Wrong password | ✅ "That email and password don't match…" |
| 3. Invalid email | ✅ "Enter a valid email address." |
| 4. New user signup | ✅ "Confirm your email" screen + resend |
| 5. Existing user login (with pending redirect) | ✅ landed on `/app/marketplace` |
| 6. Refresh while authenticated | ✅ stayed on `/app/marketplace` |
| 7. Navigate between protected routes | ✅ `/app/profile` renders |
| 8. Visit `/auth` while signed in | ✅ → `/app`, no loop |
| 9. Logout | ✅ → `/auth`, 0 auth tokens in `localStorage` |
| 10. Protected route after logout | ✅ → `/auth?redirect=%2Fapp` |
| Weak/breached password signup | ✅ rejected with readable message |

Test accounts created for validation were deleted afterwards.

## 10. Remaining issues

1. **Email confirmation gate (product decision, not a bug).** New users cannot sign in until they click the emailed link. If you want signup to sign users in immediately, say so and I'll enable auto-confirm.
2. **Email deliverability** — confirmation emails currently go through the default shared sender with a low hourly rate limit. For production, configure a custom sending domain.
3. **No password reset flow** exists yet (`resetPasswordForEmail` + `/reset-password` page). Not part of this repair scope; tell me if you want it.
4. **Pre-existing hydration warning** (unrelated to auth): the device-tier system renders `data-tier="C"` server-side and re-evaluates on the client. Harmless (React re-renders the subtree) and intentional per the device-tier design; left untouched.

## What you need to do manually

1. **Decide on email confirmation** — keep it (users must confirm before first sign-in) or ask me to enable auto-confirm.
2. **Before launch:** set up a custom email sending domain so confirmation emails aren't rate-limited.
3. Nothing else — no environment variables, provider credentials, or database changes are required.
