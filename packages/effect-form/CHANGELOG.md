# Changelog

## 0.5.0 - 2026-10-18

### Fixed

- Keep form and React hook type inference consistent when TypeScript enables the `source` condition by resolving private type aliases to the same declarations as public imports.

### Breaking

- Every module's import path is now its path under `src/`. The React entry moves from `react.ts` to `client/react.ts`.

## 0.4.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/atom-react` 4.0.4 alongside it.

## 0.3.0 - 2026-10-13

### Added

- Opt-in `Config.persistedDraft` stores encoded input and its baseline under an application key, bounded by age and size, while storage failures leave editing usable. Reload and refresh preserve edits, revert and successful submission clear accepted input, and later edits remain persisted.
- `persistence.ts` exports `PersistedDraftConfig`, `DraftStorage`, `Persistence` and `persistence`; `draftSession.ts` exports `DraftSession` and `draftSession`. React exports `usePersistedDraft`, `BrowserDraftConfig` and `DraftSessionContext` to bind browser storage and session ownership.

## 0.2.1 - 2026-10-12

### Added

- `submitter.fail` accepts nested path tuples, and `errorAt` shows typed handler rejections beside Schema messages for individual array elements.
- Optional typed `arrayKeys` selectors keep element rejections with their keys through insertion, removal and reorder, including late save responses. Changed or removed inputs discard their rejection; arrays without selectors use index paths.
- `Form.errorAt(path)` reads nested Schema feedback beneath a top-level field, including individual array entries, without adding nested field state. Top-level touch/submission controls visibility; `error(name)` retains aggregated Schema, handler and advisory messages. `messageAtPath(issue, path)` selects the first Schema message at or beneath a path; `schemaFeedback(decoded)` adapts a decoded result atom to aggregated and nested messages.

### Changed

- Document the package's purpose, form model, examples, API and boundaries; publish the README and `docs/` while keeping agent guidance out of the package.
- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.2.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-form`: `@shivaedev/effect-form/form.ts` (`make`), `@shivaedev/effect-form/messages.ts` (`FieldMessages`), `@shivaedev/effect-form/optional.ts` (`emptyAsNull`), `@shivaedev/effect-form/shape.ts` (`Checks`, `Config`, `Decoded`, `Encoded`, `Fields`, `Form`, `Name`, `Services`, `Submitter`, `FieldFailure`, `Invalid`)
  - `@shivaedev/effect-form/react`: `@shivaedev/effect-form/react.ts`

## 0.1.2 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.1 - 2026-09-26

### Changed

- Pin the `react` peer dependency to exactly 19.2.8, the version the package is
  tested against, instead of `^19.2.8`.

## 0.1.0 - 2026-09-26

### Added

- Extract schema-derived form state, submission, field messages, draft
  preservation, and optional React hooks into a reusable package.
- Merge received values per field: untouched fields adopt refreshed server
  values while edited fields keep local input.
- Keep a refresh received during an in-flight save as the baseline instead of
  replacing it with the older submitted values.
- Show an async check message only while the field still holds the value it was
  computed for.
- Clear optional field values and notify subscribers when a received or reverted
  baseline omits the field.
- Allow submit handlers to use the native atom runtime's scope, registry, and
  reactivity services.
