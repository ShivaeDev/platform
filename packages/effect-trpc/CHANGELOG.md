# Changelog

## Unreleased

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
