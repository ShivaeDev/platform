# Changelog

## Unreleased

### Changed

- Validate packed consumers and executable bins through the shared workspace gate.

## 0.1.2 - 2026-09-26

### Fixed

- Make `eventually` retry only typed failures under TestClock, matching the live
  clock. Defects and interruption propagate without retrying.

### Changed

- Document the live worker-Layer clock and the scope of per-test clock overrides.

## 0.1.1 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.

## 0.1.0 - 2026-08-30

### Added

- Add `makeEffectIt` for generator Effect tests on a worker-scoped Layer, with
  TestClock by default, an optional `around` hook, and a Clock-aware
  `eventually` helper.
