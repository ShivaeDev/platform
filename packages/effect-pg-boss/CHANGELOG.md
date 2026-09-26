# Changelog

## 0.2.0 - 2026-09-26

### Changed

- **Breaking:** Replace `developmentCacheKey` with `clientCacheKey`. The Layer
  no longer reads `NODE_ENV`; passing a key always enables client reuse, so pass
  it only in the environments that should share a client. `undefined` disables
  reuse.
- Type the `PgBossClient.work` handler with `Job<unknown>` instead of a
  caller-chosen payload type; each queue's schema decodes the payload.

## 0.1.3 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.

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
