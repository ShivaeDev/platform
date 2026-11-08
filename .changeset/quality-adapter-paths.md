---
"@shivaedev/quality": patch
---

### Changed

- Quality's Vitest DOM environment and runner bridge moved under `adapters/`: import `@shivaedev/quality/adapters/domEnvironment.config.ts` and `@shivaedev/quality/adapters/runMain.ts` in place of `@shivaedev/quality/domEnvironment.config.ts` and `@shivaedev/quality/cli/runMain.ts`. `appTestConfig` now returns Vitest's `ViteUserConfig` type.
