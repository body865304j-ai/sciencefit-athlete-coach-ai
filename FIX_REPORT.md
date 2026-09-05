# Fix Report — Production Stabilization

Date: 2026-09-05 (UTC)

## Fixes applied

1. **`/auth` search-param type contract** (`src/routes/auth.tsx`)
   The hand-written `validateSearch` returned `{ redirect: string | undefined }`, which TanStack treats as a
   **required** search key. Every link and programmatic navigation to `/auth` therefore failed typecheck
   (5 errors: `AppShell.tsx:93`, `SettingsScreen.tsx:213`, `index.tsx:98`, `index.tsx:205`,
   `reset-password.tsx:101`). Replaced with `z.object({ redirect: z.string().optional() })`.
   Runtime behaviour and deep-link preservation are unchanged.

2. **Repo-wide Prettier formatting**
   `bun run lint` reported 1113 auto-fixable `prettier/prettier` errors. Applied `prettier --write` over
   `src/**/*.{ts,tsx}`. Formatting only — no logic changed.

## Deliberately NOT changed

- **No Supabase API-key migration.** `SUPABASE_SERVICE_ROLE_KEY` remains the expected variable name; the
  existing fetch shim already accepts modern `sb_secret_...` values.
- **No RLS migration.** The proposed coach-visibility policy duplicates the existing `challenges_visible`
  policy, which already grants read access to coaches matched to a challenge. Adding it would violate the
  "no duplicate policy" requirement.
- **No changes to auto-generated integration files** (`client.server.ts`, `auth-middleware.ts`,
  `auth-attacher.ts`, `client.ts`, `previewAuthStorage.ts`, `types.ts`). The one remaining lint error
  (`prefer-const`) lives in `previewAuthStorage.ts` and is not safe to edit.

## Verification

`bunx tsgo --noEmit` → 0 errors. `bun run build` → success. Signed-in browser walkthrough passed for
dashboard, ranking, marketplace, notifications, profile, settings and the request wizard.

Full detail: `PRODUCTION_FINAL_VERIFICATION.md`.
