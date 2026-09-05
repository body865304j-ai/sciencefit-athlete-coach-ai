# Supabase Production Requirements — ScienceFit

## Server environment variables (server-only, never `VITE_`)

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Yes | admin client, auth middleware | Project REST URL |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | `requireSupabaseAuth` request-scoped client | RLS applies as the caller |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `supabaseAdmin` (`client.server.ts`) | Accepts a legacy `service_role` JWT **or** a modern `sb_secret_...` key — no code change either way |

## Browser environment variables (safe to ship)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

## Key-format compatibility

`createSupabaseFetch()` in both `client.server.ts` and `auth-middleware.ts` inspects the key prefix:

- Key starts with `sb_secret_` / `sb_publishable_` → the default `Authorization: Bearer <key>` header is
  **removed** and only `apikey: <key>` is sent. Opaque keys are not JWTs, so sending them as a bearer causes
  `Expected 3 parts in JWT; got 1`.
- Legacy JWT key → both headers are sent, which is the legacy contract.

Consequence: a modern secret key can be dropped into `SUPABASE_SERVICE_ROLE_KEY` without a broad API-key
migration. Do **not** rename the variable during stabilization — three lines in generated code reference it.

## Secret handling rules

- Server-only; read inside handlers, never at module scope.
- Never prefixed with `VITE_`, never hardcoded, never logged (error paths log variable *names* only),
  never returned to the browser, never committed.
- `supabaseAdmin` is imported only via dynamic `await import(...)` inside handlers, so the module never
  reaches a client bundle.
- Sign-in is never performed on the admin client; the admin client never receives a caller's session token.

## Database posture

- RLS enabled on every public table used by the app.
- `challenges` / `challenge_coach_matches` / `coaches`: grants present for `authenticated` and `service_role`;
  policies scoped to athlete owner, matched coach, or admin.
- `SECURITY DEFINER` helpers live in the `private` schema and are not callable over the Data API.
- No outstanding migration is required for challenge visibility.
