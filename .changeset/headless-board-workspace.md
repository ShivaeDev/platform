---
"@shivaedev/work-board": minor
---

### Added

- Provide `workspaceLayer` to use Board's scoped `Workspace`, watched documents and archived snapshots without an HTTP server. `Workspace.metadata`, `writeMetadata` and `closeDecision` read and write metadata while preserving unknown fields and Markdown bodies. Writes require explicit opt-in and refuse changed source bytes.

### Breaking

- YAML parsing and migration helpers now live under adapters. Import `metadataParse` and `metadataLocations` from `server/metadata/adapters/parse.ts` and `server/metadata/adapters/locations.ts`; import `sourceHeader`, `sourceEdits`, `replacementEdit` and `decisionClosed` from their same-named modules under `server/migration/adapters/`. The `board.metadataParse` integration API is unchanged.
