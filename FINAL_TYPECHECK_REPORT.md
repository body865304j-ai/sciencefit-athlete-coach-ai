# FINAL_TYPECHECK_REPORT.md

## Result

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `tsgo --noEmit` (tsconfig strict) | **0 errors** |
| ESLint | `eslint .` | **0 errors**, 20 warnings |

## Compiler configuration (unchanged, not weakened)

`tsconfig.json` remains at maximum strictness:

- `strict: true`
- `noFallthroughCasesInSwitch: true`
- `noImplicitOverride: true`
- `noImplicitReturns: true`
- `noPropertyAccessFromIndexSignature: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noUncheckedSideEffectImports: true`

No `any`, no `as any`, no `@ts-ignore`, and no compiler-option relaxation were
introduced to reach zero errors.

## The two reported errors

### Error 1 — `MarketplaceScreen.tsx`, `minScore` state

Resolved with an explicit generic so the slider state does not widen or narrow
incorrectly:

```ts
const [minScore, setMinScore] = useState<number>(MARKETPLACE_GATES.browse);
```

`MARKETPLACE_GATES` is `as const` in `src/lib/domain.ts`, so `browse` infers as
the literal `60`. The explicit `<number>` keeps the state assignable from the
slider callback (`setMinScore(value[0] ?? MARKETPLACE_GATES.browse)`), which
produces an arbitrary `number`.

### Error 2 — `MarketplaceScreen.tsx`, `respondToHire` argument

The server function `respondToHire` in `src/lib/profile.functions.ts` validates
input as `{ hireId: string; status: "ACCEPTED" | "DECLINED" | "WITHDRAWN" |
"ACTIVE" | "COMPLETED" }` — the canonical `hire_status` subset defined by
`src/lib/marketplace.server.ts`.

The call site now matches that canonical shape exactly, with the local handler
signature narrowed to the same union rather than a widened `string`:

```ts
async function handleRespond(
  hireId: string,
  status: "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "ACTIVE" | "COMPLETED",
) {
  await respond({ data: { hireId, status } });
}
```

Neither the server function signature nor the database enum was changed — the
client was corrected to the server's canonical type.

## Additional lint fix applied

`src/routes/_authenticated/app.marketplace.$coachId.tsx` called
`Route.useParams()` inside an inline arrow `component`, violating
`react-hooks/rules-of-hooks`. The component was extracted to a named function
component (`CoachProfileRoute`). Remaining ESLint output is 20 warnings only:
`react-refresh/only-export-components` on shadcn/ui primitives (expected for
those files) and `react-hooks/exhaustive-deps` advisories on memoized
derived lists.

## Remaining warnings (non-blocking)

| Warning | Count | Note |
| --- | --- | --- |
| `react-refresh/only-export-components` | 8 | shadcn/ui primitives + `useDeviceTier` export variants alongside components. Design-system convention; no runtime impact. |
| `react-hooks/exhaustive-deps` | 12 | Derived `?? []` fallbacks feeding `useMemo`/`useEffect`. Recomputation only; no correctness defect. |
