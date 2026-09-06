# Auth Email Verification — Root Cause Report

## 1. Exact root cause

**ROOT_CAUSE 3 — Missing email sender configuration (external to the code).**

The project has **no sender/email domain configured**. Email confirmation is enabled and Supabase
Auth *does* generate confirmation emails (every `auth.users` row has a populated
`confirmation_sent_at`), but with no verified sending domain the project falls back to the shared
default sender, which is heavily rate limited and frequently filtered or dropped by recipient
mailbox providers. Delivery is therefore unreliable — which matches the reported symptom
(signup succeeds, no email arrives).

Not the cause: application code, auth configuration, redirect URL, email template, or an app-level
rate limit. No code path suppresses confirmation, and nothing assumes a session exists after signup.

## 2. Evidence

- Email domain status: `not_started` — no email domain recorded for this project.
- Delivery logs: no delivery events in the visible retention window (no successful sends recorded).
- `auth.users`: recent signups have `confirmation_sent_at` set and `email_confirmed_at` null →
  GoTrue generated and handed off the mail; the failure is at delivery, not generation.
- Historical rows show some confirmed users, i.e. the default sender sometimes lands and sometimes
  does not — the signature of an unverified/shared sending domain.
- Auth log query returned no error rows: no rejection or SMTP hand-off error was recorded.

## 3. Files inspected

- `src/routes/auth.tsx` (signup, resend, reset)
- `src/routes/reset-password.tsx`
- `src/hooks/useSession.ts`, `src/lib/auth-errors.ts`
- `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`
- `supabase/config.toml`, `.env`
- Live: `auth.users`, auth logs, email delivery logs, email domain status

## 4. Files changed

- `src/routes/auth.tsx` — pending-confirmation UX only. No auth/security behaviour weakened.
- `AUTH_EMAIL_VERIFICATION_ROOT_CAUSE.md` (this file)

Changes: "Check your email" screen with masked address, honest wording ("a confirmation link was
requested"), inline resend errors instead of a false success, a 60s resend cooldown (30s after an
error) to prevent endpoint spamming, plus "Use a different email" and "Back to sign in" actions.

## 5. Supabase configuration required

- Email/password auth: enabled ✅
- Confirm email: enabled ✅ (kept — not disabled)
- Auto-confirm: disabled ✅ (kept)
- Site URL / redirect allowlist: managed by the platform, preview and production URLs resolve
  correctly ✅
- **Required manual step:** configure a sender domain the project owns, then verify its DNS.

## 6. SMTP status

No custom SMTP and no verified sending domain. No SMTP credentials exist anywhere in the codebase,
and none are exposed through `VITE_` variables. A production-grade sending domain must be set up
before confirmation emails can be relied on.

## 7. Redirect URL status

`emailRedirectTo` is `window.location.origin` and the reset callback is
`${window.location.origin}/reset-password`. Same-origin, HTTPS in preview/production, never
hardcoded localhost, and no wrong domain or path. ✅

## 8. Email template status

Default Supabase confirmation template — valid, with an intact confirmation URL variable. Not the
failure point. Branded templates become available once a sender domain is verified.

## 9. Rate-limit status

No `rate_limited` delivery events and no `over_email_send_rate_limit` errors observed. The auth
hourly email cap remains at its default; raising it requires active email sending, so it is a
follow-up after the domain is verified. Client-side resend is now throttled.

## 10. Security verification

- No service-role key or SMTP credential in browser code or in any `VITE_` variable.
- Server secrets are read only inside server handlers; nothing secret is logged or committed.
- Auth errors are still mapped to non-enumerating, user-safe copy.
- Email confirmation remains enforced; no auto-confirm, no bypass.

## 11. Test results

- Signup with email confirmation enabled: user row created, **no session granted** before
  confirmation, confirmation generated. ✅
- Pending-confirmation UI, masked address, resend throttling, error handling: verified. ✅
- Typecheck passes. ✅
- **Confirmation email received and link clicked: NOT verified** — no sending domain exists, so no
  end-to-end delivery test is possible.

## 12. Remaining manual setup

Configure and verify a sender domain for the project. Until DNS verification completes, confirmation
emails continue to depend on the unreliable shared default sender.

---

## FINAL STATUS

**BLOCKED — external configuration/manual setup is still required** (sender domain not configured;
no confirmation email could be received and tested end to end).
