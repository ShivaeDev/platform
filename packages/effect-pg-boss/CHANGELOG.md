# Changelog

## Unreleased

## 0.1.2 - 2026-08-12

### Changed

- Require Effect 4.0.0-rc.108. The 4.0 release candidate starts the stable line,
  so consumers pick up the compatibility promise the betas did not carry.

## 0.1.1 - 2026-08-12

### Changed

- Require Effect 4.0.0-beta.107, so applications can depend on packages such as
  `@effect/platform-node` that are only published against the current beta line.

## 0.1.0 - 2026-08-03

### Added

- Add Effect services for typed pg-boss queues, Schema-decoded workers,
  scheduled jobs, retry and dead-letter setup, enqueueing, health checks, and
  scoped client lifecycle management.
