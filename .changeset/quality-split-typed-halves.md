---
"@shivaedev/quality": minor
---

### Added

- A rule definition may declare `deepHalf: { check, name }`. Its `check` runs on every lint, `deepHalf.check` runs only where deep rules run (CI, a Claude Code cloud session and `quality lint --full`), and both report under the rule's id. A fast run names each skipped half in its closing line as the rule id followed by `name`. `Rule.configure` still returns a `check` that runs both halves.
- A baseline entry of a rule with a deep half records `deep`, how many of its `count` violations the deep half reports: `{"path":"src/sync.ts","rule":"effect/boundary","count":5,"deep":2}`. `baseline write`, `tighten` and `prune` write it, and lower the fast and deep shares separately. A fast run judges the fast share exactly, so a fixed syntax finding makes the entry loose and the commit check asks for `quality baseline tighten --staged`, and an added one fails. A full run judges the total. The merge driver takes the minimum of each share when both sides record it, and merges the totals as before when either side does not.

### Changed

- `effect/boundary` and `suppressions/no-double-cast` split into a syntax half that runs on every lint and a typed half that runs where deep rules run. Together they report exactly what each rule reported before. A local `quality lint` no longer reports `effect/boundary`'s calls to throwing helpers imported from other modules, `Effect.sync` bodies that reach one, or Promise-typed parameters, nor `suppressions/no-double-cast`'s readonly writes and SQL row generics on a tag other than `sql`; CI and `quality lint --full` still do. Calls to throwing helpers defined in the same module are still reported locally.
- Until an application runs `quality baseline tighten` once to record `deep` in its `effect/boundary` and `suppressions/no-double-cast` entries, a local commit does not lock in fixed debt for these two rules: a fast run treats such an entry as an upper bound, and a full run notes how many entries still lack it.
- The closing line counts deep checks rather than deep rules: `quality: fast run skipped 3 deep checks (effect/boundary typed half, effect/service-parameters, suppressions/no-double-cast typed half); …`, and a full run ends with `quality: full run ran 3 deep checks (…).`
