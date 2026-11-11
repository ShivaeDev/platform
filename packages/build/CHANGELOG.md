# Changelog

## 0.1.1 - 2026-11-11

### Changed

- The README's examples name a module file after its export, as in `src/modules/notes/Notes.ts` and `#generated/modules/notes/Notes.ts`, and import operations from the module's `server/` folder, as applications write them.

### Fixed

- Generating no longer leaves an empty `.<file>.XXXXXX` folder beside every file it writes, under `src/generated` and in `node_modules/.cache/@shivaedev/build`. Each write still replaces the file in one rename, and its temporary folder is removed when the write ends, also when it fails or is interrupted. Folders left by earlier versions stay until you delete them.

## 0.1.0 - 2026-11-11

### Added

- The package is published. `appViteConfig` from `@shivaedev/build/adapters/appViteConfig.ts` and `appTestConfig` from `@shivaedev/build/adapters/appTestConfig.ts` give an application its Vite and Vitest configuration with the generator built in: `vite build` and the dev server generate first, and Vitest generates in its global setup before any test file loads.
- `appViteConfig` runs the bundle check by default, so a build whose browser bundle reaches server code fails; its fourth argument names server-only packages with `serverOnly`. An application whose browser still imports old-form contracts or operation files passes `{ bundleCheck: false }`. The option is temporary: it exists for applications still on the old operation form and goes away with that form.
- The `shivaedev-build` command runs from source inside a workspace before any build.
