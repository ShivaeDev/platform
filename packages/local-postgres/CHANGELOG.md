# Changelog

## Unreleased

### Changed

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

## 0.1.0

- Prepare one persistent local PostgreSQL 18.6 service and create missing databases without resetting existing data.
- Validate loopback database targets and local Docker endpoints; use host or container PostgreSQL client tools.
