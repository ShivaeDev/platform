---
"@shivaedev/quality": minor
---

### Added

- A rule definition may declare `deepHalf: { check, name }`. Its `check` runs on every lint, `deepHalf.check` runs only where deep rules run (CI, a Claude Code cloud session and `quality lint --full`), and both report under the rule's id. A fast run names each skipped half in its closing line as the rule id followed by `name`, and judges that rule's baseline entries only as upper bounds: a file over its count still fails, and an entry with fewer or no findings is neither loose nor stale. `Rule.configure` still returns a `check` that runs both halves.

### Changed

- `effect/boundary` and `suppressions/no-double-cast` split into a syntax half that runs on every lint and a typed half that runs where deep rules run. Together they report exactly what each rule reported before. A local `quality lint` no longer reports `effect/boundary`'s calls to throwing helpers imported from other modules, `Effect.sync` bodies that reach one, or Promise-typed parameters, nor `suppressions/no-double-cast`'s readonly writes and SQL row generics on a tag other than `sql`; CI and `quality lint --full` still do. Calls to throwing helpers defined in the same module are still reported locally.
- A local commit no longer requires an `effect/boundary` or `suppressions/no-double-cast` baseline entry to be tightened when its file's syntax findings drop, because the skipped typed half may hold the rest of the count; `quality baseline tighten` lowers it.
- The closing line counts deep checks rather than deep rules: `quality: fast run skipped 3 deep checks (effect/boundary typed half, effect/service-parameters, suppressions/no-double-cast typed half); …`, and a full run ends with `quality: full run ran 3 deep checks (…).`
