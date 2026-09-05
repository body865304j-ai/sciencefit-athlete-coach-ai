# Deployment Checklist — ScienceFit

## 1. Environment

- [ ] `SUPABASE_URL` set (server)
- [ ] `SUPABASE_PUBLISHABLE_KEY` set (server)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (server) — legacy JWT or modern `sb_secret_...` both accepted
- [ ] `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` present for the browser
- [ ] No `VITE_`-prefixed secret exists anywhere
- [ ] No secret value is committed to Git

## 2. Database

- [ ] RLS enabled on all public tables — verified
- [ ] Grants present for `authenticated` / `service_role` on `challenges`, `challenge_coach_matches`, `coaches` — verified
- [ ] `challenges_visible` policy already covers matched coaches — **no new migration needed**
- [ ] `SECURITY DEFINER` helpers isolated in the `private` schema — verified

## 3. Build gates

- [ ] `bunx tsgo --noEmit` → 0 errors
- [ ] `bun run lint` → no errors in authored code (one `prefer-const` remains in an auto-generated, non-editable file)
- [ ] `bun run build` → succeeds

## 4. Functional smoke test (signed-in session)

- [x] Login / session restore
- [x] Athlete Dashboard
- [x] Coach Dashboard
- [x] Challenge list (empty state)
- [ ] Open Challenge — requires seeded challenge data
- [ ] Challenge Details — requires seeded challenge data
- [ ] Program Builder — requires an open challenge
- [ ] Challenge Submission — requires an open challenge
- [ ] Challenge Results — requires a completed evaluation
- [x] Ranking
- [x] Marketplace
- [x] Notifications / Profile / Settings / Request Wizard

## 5. Post-deploy

- [ ] Configure the email sending domain (auth confirmation + password reset delivery)
- [ ] Re-run the security linter after any policy change
- [ ] Exercise the full challenge lifecycle once real athlete/coach data exists
