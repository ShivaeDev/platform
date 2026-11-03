---
"@shivaedev/work-board": minor
"@shivaedev/work-fleet": minor
---

### Added

- `@shivaedev/work-board`: Expose original frontmatter values on `ParsedMetadata.values` for application-owned fields.

### Changed

- `@shivaedev/work-fleet`: Read Board's headless workspace index and archived records, and write completion metadata and decision closure through its guarded write API. Fresh Fleet reads advance the shared index. Source availability failures name Board's indexed unavailable paths.
- `@shivaedev/work-board`: Headless index reads keep the workspace's owning context when a request supplies its own clock. Source read failures remain in the read channel rather than preventing workspace startup.

### Breaking

- `@shivaedev/work-board`: Pure metadata modules move from `server/metadata/` to `metadata/`. Import `metadataParse` and `metadataLocations` from `metadata/adapters/parse.ts` and `metadata/adapters/locations.ts` instead of their former server paths.
- `@shivaedev/work-fleet`: Remove standalone Board readers, `readPass.BoardSnapshot`, snapshot mutation helpers and completion patch helpers. Integrations should use Board's `Workspace` and `workspaceLayer`; Fleet's `markdownBoard` gateway keeps its scheduling and decision operations. Pass native Board snapshot Effects to `decisionReading` and `recordDecisionResponse`.
