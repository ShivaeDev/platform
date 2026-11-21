---
"@shivaedev/build": minor
"@shivaedev/create-app": minor
"@shivaedev/quality": patch
---

### Added

- `@shivaedev/build`: `shivaedev-build generate` also writes the server's module list to `src/generated/server/modules.ts`: every registration written `satisfies AppModule` from `@shivaedev/server/AppModule.ts`, imported by name or through a namespace and exported as `export const` or through a separate `export { ... }`, one import each, in the order of their files' paths, as `export const modules = [...] as const`. Registrations in `test-support` folders and test files are left out. `--check` reports the list missing or stale, and the dev server's plugin writes it again when a registration file appears or changes, so a module created while the dev server runs is served without a restart.

### Fixed

- `@shivaedev/quality`: in a checkout without Git, the `.gitignore` files decide which imported files are ignored output, as they decide which files are sources, so an export that only generated output imports counts as used there too.

### Breaking

- `@shivaedev/build`: `generate` now refuses three registration shapes the server's module list would leave out, on every run and also in an application that still lists its modules by hand, naming the file and the fix, and the list keeps its last content: an exported registration typed `: AppModule` or cast `as AppModule`; an exported object naming `module`, or `group` and `handlers`, and its `services` without `satisfies AppModule`; and a `server/registration.ts` under the project's `modules` folders that exports something but no registration the list finds, such as one built by a function call. To migrate, write `satisfies AppModule` after the exported registration's object, with `AppModule` imported from `@shivaedev/server/AppModule.ts`, and export the registration from its module's `server/registration.ts` as that const.
- `@shivaedev/create-app`: generated apps register server modules by their folder. `src/server/modules.ts` imports `modules` from `#generated/server/modules.ts` and composes `appModules([serverRegistration(modules), ...modules], { replacements })`, and `create-app add-resource` no longer edits it. To migrate an app with a hand-written list, delete `const modules = [...] as const;` and the imports of the registrations it names from `src/server/modules.ts`, add `import { modules } from "#generated/server/modules.ts";`, keep the foundation's `serverRegistration(modules)` in the composition, make sure each module's registration is exported and written `satisfies AppModule`, and run `pnpm generate`. `create-app update` makes this change itself when the app never edited its list, and leaves conflict markers in `src/server/modules.ts` when it did. The starter's `dev` script now generates before it migrates, so a new module's migrations run on the first start.
