---
"@shivaedev/work-board": minor
---

### Added

- Publish immutable report text or bytes with `publishOnce`, or replace a file against its expected source with `replaceIfUnchanged`, using the `Publication` service and its Node layer. Interrupted staging cleans up before the Effect finishes.

### Breaking

- Replace imports of `server/responses/publicationDirectory.ts` and `server/responses/publishIn.ts` with the Effects in `server/publication.ts`, providing `Publication.layer`. Native directory handles now belong to Board's adapters.
- Import the native Fleet health reader from `server/adapters/fleetHealth.ts` instead of `server/diagnostics/fleetHealth.ts`.
