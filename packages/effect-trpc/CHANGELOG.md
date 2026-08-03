# Changelog

## Unreleased

## 0.1.1 - 2026-08-03

### Fixed

- Run consumer instrumentation inside request-scoped Layers so logging and
  tracing hooks can read services derived from the tRPC context.

## 0.1.0 - 2026-08-03

### Added

- Add Effect-native tRPC query and mutation procedures, request Layers, safe
  error handling, instrumentation hooks, and an Effect Vitest caller.
