# Changelog

## Unreleased

## 0.3.4 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.
- Require Effect Test 0.1.1, which moves to the same Effect release.

## 0.3.3 - 2026-08-30

### Changed

- Build `makeTrpcIt` and `makeTrpcHarnessIt` on `@shivaedev/effect-test`
  instead of a private Vitest runner.

### Added

- Accept `clock: "live"` on `makeTrpcIt`, `makeTrpcHarnessIt`, and
  `effectTRPC` tests to use wall-clock time instead of TestClock.

## 0.3.2 - 2026-08-12

### Changed

- Require Effect 4.0.0-rc.108. The 4.0 release candidate starts the stable line,
  so consumers pick up the compatibility promise the betas did not carry.

## 0.3.1 - 2026-08-12

### Changed

- Require Effect 4.0.0-beta.107, so applications can depend on packages such as
  `@effect/platform-node` that are only published against the current beta line.

## 0.3.0 - 2026-08-03

### Added

- Add Effect Stream subscriptions with request-scoped Layers, transport
  cancellation, finalizers, tracing, and stream instrumentation.
- Accept a shared application runtime so tRPC calls and other promise-based
  adapters use the same ambient Effect services.

## 0.2.0 - 2026-08-03

### Added

- Build an application-defined Effectful test harness around a typed tRPC
  caller while retaining worker-scoped Layers and standard Vitest variants.

## 0.1.1 - 2026-08-03

### Fixed

- Run consumer instrumentation inside request-scoped Layers so logging and
  tracing hooks can read services derived from the tRPC context.

## 0.1.0 - 2026-08-03

### Added

- Add Effect-native tRPC query and mutation procedures, request Layers, safe
  error handling, instrumentation hooks, and an Effect Vitest caller.
