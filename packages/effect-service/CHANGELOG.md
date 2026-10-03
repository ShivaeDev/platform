# Changelog

## Unreleased

### Changed

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

## 0.1.0 - 2026-09-26

### Added

- Declare service dependencies once and bind them in scoped initialization and
  ordinary Effect methods.
- Preserve typed initialization failures, method failures, caller scopes, and
  explicitly marked generic methods.
