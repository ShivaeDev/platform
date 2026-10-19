---
"@shivaedev/quality": minor
"@shivaedev/effect-pg-boss": minor
"@shivaedev/effect-test-sql": minor
"@shivaedev/local-postgres": minor
"@shivaedev/test-story": minor
"@shivaedev/work-board": minor
---

### Added

- Quality's `manifests/exports-shape` rule checks exports at the package root and in workspace members by default. Modules use one file-preserving TypeScript wildcard with matching source, types and runtime targets; root entries, exact non-code assets, package metadata and null blocks are allowed.

### Breaking

- Quality's Biome preset moves from `@shivaedev/quality/biome` to `@shivaedev/quality/biome/preset.json`. Change the `extends` entry in your Biome config to the new path; the old alias is removed. TypeScript preset paths are unchanged.
- `@shivaedev/effect-pg-boss`, `@shivaedev/effect-test-sql`, `@shivaedev/local-postgres` and `@shivaedev/test-story` expose server modules at their file paths. Add `/server/` after the package name in imports, for example `@shivaedev/test-story/server/storyKit.ts`. The shortened paths are removed; internal server modules remain blocked.
- Work Board moves `@shivaedev/work-board/client/client.ts` to `@shivaedev/work-board/browserClient.ts`; change browser-client imports to that file path. `@shivaedev/work-board/client/document/View.ts` is removed: consume document queries with your own renderer, or use the bundled Board browser UI. The client bundle stays private and the old export overrides are removed.
