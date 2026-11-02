---
"@shivaedev/create-app": patch
"@shivaedev/vitest-rerun": patch
---

### Changed

- `@shivaedev/create-app`: Generated apps run lint, typecheck and tests through the shared heavy lock, and rerun failed tests in a fresh process by default. Test reports stay out of Git and generated templates.

### Fixed

- `@shivaedev/vitest-rerun`: Honor `--passWithNoTests` when a run finds no test files, so generated apps support the config smoke check before builds.
