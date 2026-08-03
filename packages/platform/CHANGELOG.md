# Changelog

## Unreleased

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
