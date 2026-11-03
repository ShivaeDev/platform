---
"@shivaedev/work-fleet": minor
---

### Changed

- Fleet publishes report documents, attachments, retained payloads and completion bookkeeping through Board’s publication port. Recovery retains the first completed report, and completion preserves source edits.

### Breaking

- Remove `board/reportFiles.ts`, `board/reportPayloadFile.ts`, `board/writeCompletion.ts` and `reportFileDirectory.ts`. Consumers publishing files use `Publication`, `publishOnce` and `replaceIfUnchanged` from `@shivaedev/work-board/server/publication.ts`, providing `Publication.layer`. Consumers retaining completed report output use `board/reportPayload.ts`.
- `reportPayload`, `writePublished`, `writeHealth`, `writeStatus` and `upgradeDecisionClosure` now read `FileSystem` from the Effect environment. Provide the Node services layer when calling them directly; Fleet’s host layers supply it.
