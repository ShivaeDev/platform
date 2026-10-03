# Changelog

## Unreleased

### Changed

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.1 - 2026-09-26

### Changed

- Pin the `react` peer dependency to exactly 19.2.8, the version the package is
  tested against, instead of `^19.2.8`.

## 0.1.0 - 2026-09-26

### Added

- Extract schema-derived form state, submission, field messages, draft
  preservation, and optional React hooks from Antumbra.
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
