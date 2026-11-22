---
"@shivaedev/build": minor
---

### Breaking

- The bundle check finds `@shivaedev/contract`'s `defineModule.ts` and `operation.ts` and `effect/sql` as each folder of the browser's module graph resolves them, as well as from the project's root. Before, it resolved them from the root alone, so when a workspace package brought its own contract or Effect and the root resolved none, its module files, operation files and SQL repositories reached the browser bundle without a failure. A build that passed with such a package now fails with the import chain to that file. To migrate, import the module's generated client in the browser instead, as for a file of the application itself.
- `ServerMarkers.defineModule` and `ServerMarkers.sql`, read by `serverCodeIn` from `@shivaedev/build/serverCode.ts`, are now sets: every id `@shivaedev/contract/defineModule.ts` resolves to, and every folder `effect/sql` resolves into. A caller that builds the markers itself passes `new Set([id])` where it passed `Option.some(id)`, and an empty set where it passed `Option.none()`; `buildPlugin`, `appViteConfig` and `bundleCheck` need no change.
