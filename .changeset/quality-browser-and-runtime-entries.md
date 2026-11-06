---
"@shivaedev/quality": patch
---

### Fixed

- Stop the service-parameter type walk at DOM and React library types while still reporting application services passed as parameters.
- Feed Git's ignored paths into Biome's file selection so pre-commit checks in nested worktree projects respect repository-relative excludes.
- Give `noProcessGlobal` and `effect/adapter-imports` consistent advice: use an adapter with explicit imports that exposes Effect values, and `Config` for environment variables.
- Recognise scripts spawned by path and modules referenced only by `vi.mock` as unused-code entry points without rule options.
