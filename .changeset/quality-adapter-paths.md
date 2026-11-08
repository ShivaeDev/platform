---
"@shivaedev/quality": minor
---

### Breaking

- Quality's Vitest DOM environment moved under `adapters/`. Replace `@shivaedev/quality/domEnvironment.config.ts` with `@shivaedev/quality/adapters/domEnvironment.config.ts`.
- Quality's CLI runner bridge moved under `adapters/`. Replace `@shivaedev/quality/cli/runMain.ts` with `@shivaedev/quality/adapters/runMain.ts`.

### Changed

- `appTestConfig` now returns Vitest's `ViteUserConfig` type.
