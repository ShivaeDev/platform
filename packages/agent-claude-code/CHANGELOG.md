# Changelog

## 0.3.0 - 2026-11-04

### Added

- Implement the shared agent port for Claude Code with native session resume, distinct queued input and priority-now steering, interruption and scoped query cleanup.
- Bind application MCP tools and convert provider messages, child lineage, usage and cost into shared agent events.
- Reconcile stream, mirror and repair transcript lanes by provider UUID, declaring missing and spilled output as explicit gaps. Keep the Claude and MCP SDKs optional peers; image input and model discovery remain unsupported.

## 0.2.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.1.0 - 2026-11-03

### Added

- Publish a package skeleton with no API yet.
