---
"@shivaedev/create-app": minor
---

### Added

- Export generator modules through `@shivaedev/create-app/*.ts` so tooling can reuse scaffolding, template packing and starter updates. Importing `cli.ts` or `pack.ts` leaves execution to their direct command invocations.
