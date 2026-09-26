# Changelog

## Unreleased

### Changed

- Validate packed consumers and executable bins through the shared workspace gate.

## 0.4.0 - 2026-09-26

### Added

- `rejectWith(schema)` sends failures matching a tagged schema to the client as
  a `RejectionError` carrying the schema-encoded value. The tRPC code follows
  the Platform error taxonomy (`NotFound`, `Unauthorized`, `Forbidden`,
  `Conflict`, `PreconditionFailed`, and `AuthUnavailable` as
  `SERVICE_UNAVAILABLE`), otherwise `BAD_REQUEST`, or a `code` option.
  `rejectionCode` exposes that mapping.
- `rejectionFormatter` and `withRejection` add the encoded value to the error
  data as `data.rejection`. An input that fails the procedure's input schema
  becomes a `BadRequest` rejection whose `field` is the first issue's dotted
  path.
- `@shivaedev/effect-trpc/client`, a browser-safe entry that imports only
  Effect: `rejectionOf(error)` reads the encoded rejection from a
  `TRPCClientError` and `decodeRejection(schema)(error)` decodes it.

### Changed

- Require Effect Test 0.1.2, whose `eventually` retries only typed failures.

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
