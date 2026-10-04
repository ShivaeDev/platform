# Changelog

## 0.1.3 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.2 - 2026-09-26

### Fixed

- Make `eventually` retry only typed failures under TestClock, matching the live
  clock. Defects and interruption propagate without retrying.

### Changed

- Document the live worker-Layer clock and the scope of per-test clock overrides.

## 0.1.1 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.

## 0.1.0 - 2026-08-30

### Added

- Add `makeEffectIt` for generator Effect tests on a worker-scoped Layer, with
  TestClock by default, an optional `around` hook, and a Clock-aware
  `eventually` helper.
