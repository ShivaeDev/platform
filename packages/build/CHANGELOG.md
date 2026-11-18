# Changelog

## 0.2.2 - 2026-11-18

### Changed

- Update `@shivaedev/quality` from 0.78.2 to 0.78.3.

## 0.2.1 - 2026-11-18

### Changed

- Update `@shivaedev/quality` from 0.78.1 to 0.78.2.

## 0.2.0 - 2026-11-18

### Added

- `buildPlugin` and the fourth argument of `appViteConfig` take `oldFormFolders`, a list of folders, as paths or globs from the project's root, whose features are still on the old operation form. A file under a listed folder may import `query` or `command` and reach the browser bundle; the bundle check still follows its imports, so server code reached through it fails the build, and so does an old-form contract in a folder that is not listed. An application that set `bundleCheck: false` only because of its old-form contracts can list their folders instead and keep the check on for the features it has moved to `defineModule`. An entry whose folder the bundle no longer imports an old-form file from fails the build and names the entry. The option is temporary and goes away with the old operation form.
- `bundleCheck` from `@shivaedev/build/adapters/bundleCheck.ts` takes the same list as an optional second argument.

### Breaking

- `serverCodeIn` from `@shivaedev/build/serverCode.ts` reads `oldFormFolders` from its options and from each `BundleModule`. A caller that builds the graph itself passes `oldFormFolders: []` in both places; `buildPlugin`, `appViteConfig` and `bundleCheck` need no change.

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
