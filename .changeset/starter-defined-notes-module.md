---
"@shivaedev/create-app": minor
---

### Changed

- Generated applications write each notes operation once, as `payload` and `*run` in its own file under `src/modules/notes/server/`, listed in `src/modules/notes/Notes.ts` with `defineModule` and registered as `module: Notes`. `pnpm generate` writes the module's wire and browser contract into `src/generated`, and client code imports it from `#generated/modules/notes/Notes.ts`. A constraint violation that no operation maps now answers `InternalServerError` instead of `Conflict`.
