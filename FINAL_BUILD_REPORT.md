# FINAL_BUILD_REPORT.md

## Build status: ✅ SUCCESS

| Stage | Command | Result |
| --- | --- | --- |
| Typecheck | `tsgo --noEmit` | 0 errors |
| Lint | `eslint .` | 0 errors / 20 warnings |
| Production build | `vite build` | ✅ built, client + SSR worker emitted |
| Worker packaging | nitro / wrangler | `dist/server/wrangler.json`, `dist/nitro.json`, `dist/client/_headers` generated |

Client bundle output: **~2.4 MB** total on disk (pre-gzip, includes the
code-split Three.js chunk that only Tier A/B devices ever download).

## Notable chunks

| Chunk | Raw | Gzip |
| --- | --- | --- |
| `@react-three/drei` + three (lazy) | 2,142 kB | 435 kB |
| `@tanstack/react-router` | 653 kB | 137 kB |
| `recharts` | 515 kB | 97 kB |
| `@supabase/auth-js` | 312 kB | 64 kB |
| `zod` | 100 kB | 17 kB |

The Three.js chunk is loaded through `src/components/three/LazyScene.tsx` only
after tier detection resolves to A or B. Tier C and `prefers-reduced-motion`
users never request it.

## Runtime verification (headless Chromium against the running app)

| Check | Result |
| --- | --- |
| Landing page `/` renders | ✅ 200, hero + chapters painted |
| 3D canvases mount (Tier A host) | ✅ 2 `<canvas>` elements (Globe scene + AI Core scene) |
| Browser console errors on landing | ✅ none |
| `/app` unauthenticated | ✅ redirects to `/auth` |
| `/app/marketplace` unauthenticated | ✅ redirects to `/auth` |
| `/app/profile` unauthenticated | ✅ redirects to `/auth` |
| `/app/settings` unauthenticated | ✅ redirects to `/auth` |
| `/app/notifications` unauthenticated | ✅ redirects to `/auth` |
| `/app/ranking` unauthenticated | ✅ redirects to `/auth` |
| `/auth` page renders with correct `<title>` | ✅ "Sign in — ScienceFit" |

Every protected route is correctly gated by the `_authenticated` route guard;
none leaked content to an anonymous visitor.

### Scope note on authenticated verification

The verification sandbox reported `LOVABLE_BROWSER_AUTH_STATUS=signed_out`, so
no session could be minted for an end-to-end click-through of the signed-in
screens. Authenticated surfaces (Dashboards, Request Wizard, Program Builder,
Evaluation, Ranking, Marketplace, Profile, Settings, Notifications) are
verified by: strict typecheck across their server functions and components,
successful SSR prerender in the production build, and confirmed route-guard
behaviour. A signed-in click-through remains the one manual QA step before
launch — see `FINAL_PROJECT_STATUS.md`.

## Device tier behaviour at build time

| Tier | Detection (ENGINEERING_PRINCIPLES §5.2) | Rendering |
| --- | --- | --- |
| A | ≥8 cores, ≥8 GB, WebGL2, 4g | Full R3F scenes, particles, LOD globe, GSAP scroll film |
| B | mid-range hardware | Reduced particle counts, simplified shaders, lower DPR cap |
| C | entry-level / no WebGL / reduced-motion | Static imagery + CSS animation; Three.js chunk never fetched |

Tier logic lives in `src/lib/device-tier.ts` and `src/hooks/useDeviceTier.tsx`;
per-tier budgets in `src/components/three/scene-config.ts`; adaptive DPR and
FPS auto-degrade in `src/components/three/usePerformanceMonitor.ts`.
