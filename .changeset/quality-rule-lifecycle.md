---
"@shivaedev/quality": minor
---

### Breaking

- Configured rules now return an Effect. Use `yield* configured.check(inputs)` and provide the services required by the check at your application's boundary; raw `Rule.configure` implementations must return an Effect check. `defineRule` still accepts synchronous and Promise checks, now also accepts Effect checks, and supplies `context.signal` for cancellable Promise work.
- `runBiome`, `biomeReport`, `recommendedRules`, `runKnip` and `withExceptionConfig` now return Effects. Compose them with `yield*` instead of awaiting them; supply the filesystem and child-process services, and scope `withExceptionConfig` and its Effect callback. Engine scans and CLI commands that run rules require both services too.
- Rule crashes are defects rather than `SetupFailure` values. Handle expected setup failures in the error channel and use Effect cause handling for rule defects.

### Fixed

- Scoped Biome configs preserve malformed VCS settings so the native tool reports them instead of applying defaults.
- Interrupting rules stops Biome and knip child processes and removes their scoped temporary configs before the run ends.
- A crashing rule prints its id and original stack through `Cause.pretty`. Setup failures retain their original cause as a non-enumerable property.
