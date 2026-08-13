# Changelog

## Unreleased

## 0.3.4 - 2026-08-12

### Changed

- Require Effect 4.0.0-rc.108. The 4.0 release candidate starts the stable line,
  so consumers pick up the compatibility promise the betas did not carry.
- Require Effect Prisma 0.5.3 and Effect tRPC 0.3.2, which move to the same
  Effect release.

## 0.3.3 - 2026-08-12

### Changed

- Require Effect 4.0.0-beta.107, so applications can depend on packages such as
  `@effect/platform-node` that are only published against the current beta line.
- Require Effect Prisma 0.5.2 and Effect tRPC 0.3.1, which move to the same
  Effect release.

## 0.3.2 - 2026-08-12

### Changed

- Require Effect Prisma 0.5.1, so the test harness requirement channel names
  the database executor service again instead of collapsing to `never`.

## 0.3.1 - 2026-08-12

### Changed

- Require Effect Prisma 0.5.0, which adds the experimental SQLite entrypoint
  and UTC decoding for zone-less SQLite datetime values.

## 0.3.0 - 2026-08-03

### Added

- Add a Node/Bun subscription signal that combines Web and procedure aborts
  with request and socket close events for reliable long-lived response cleanup.

## 0.2.3 - 2026-08-03

### Fixed

- Require Effect Prisma 0.4.3 so generated timestamp codec references normalize
  to `Date`.

## 0.2.2 - 2026-08-03

### Fixed

- Require Effect Prisma 0.4.2 so applications can normalize generated
  timestamp declarations without recursively expanding client types.

## 0.2.1 - 2026-08-03

### Fixed

- Require Effect Prisma 0.4.1 so PostgreSQL timestamp fields use their runtime
  `Date` types throughout the shared application setup.

## 0.2.0 - 2026-08-03

### Added

- Add a shared application runtime that carries Effect services across tRPC,
  Better Auth, and other promise boundaries.
- Add a Better Auth adapter backed by Effect Prisma, including transaction
  propagation and PostgreSQL filter support.
- Add a `promise` test-harness helper for driving promise-based boundaries
  inside the test rollback transaction.

## 0.1.0 - 2026-08-03

### Added

- Add an opinionated Effect Vitest harness that combines typed tRPC callers,
  direct Prisma access, rollback isolation, and application-owned fixtures.
