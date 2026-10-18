---
"@shivaedev/quality": minor
---

### Added

- `testProjects()` selects test-story's DOM environment for DOM tests and specs, preserving Node host constructors alongside the happy-dom window without a project remap.
- `testProjects({ coverage: true })` enables V8 coverage for selected projects, including unvisited source files and excluding tests and fixtures. The exported `TestProjectsOptions` type also accepts native Vitest coverage options through `coverage` to customize the report.

### Breaking

- DOM projects use test-story's environment instead of plain happy-dom. Install `@shivaedev/test-story` alongside `happy-dom`, and target the DOM window when stubbing browser APIs. Storage fixtures should bind global storage reads to `window.localStorage`; the Node host and DOM window keep separate constructors.
