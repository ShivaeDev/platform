---
"@shivaedev/create-app": patch
"@shivaedev/quality": minor
---

### Breaking

- `@shivaedev/quality`: `imports/resolvable` takes no `generated` option, and a config that sets it is refused. Delete the option from `quality.config.ts`: Quality knows that the generator writes to `src/generated` at the project's root and in each workspace package. `RuleInputs.generated` is gone with it.

### Changed

- `@shivaedev/quality`: `quality lint`, which the pre-commit hook and `quality ci` run too, first runs the `generate` script of the project's `package.json` through its package manager, so a fresh checkout, a newly written module and a deleted `src/generated` lint the same as an up-to-date tree. A project without a `generate` script runs nothing. When the script fails, the run stops with its output and exit code 2.
- `@shivaedev/quality`: An import of a generated file that the generator does not write is reported by `imports/resolvable`, which names the module file that would define it, and `docs/references` reports a path to one, instead of accepting any path into a declared folder.
- `@shivaedev/create-app`: The app's `quality.config.ts` no longer names `src/generated`, and a minimal app's config is the full app's.
- `@shivaedev/create-app`: `create-app resource` no longer adds a `generated` entry to a minimal app's `quality.config.ts`, and no longer refuses a config whose rules cannot take one.
