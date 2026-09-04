# Changelog

## Unreleased

## 0.1.1 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.

## 0.1.0 - 2026-08-30

### Added

- Add `makeEffectIt` for generator Effect tests on a worker-scoped Layer, with
  TestClock by default, an optional `around` hook, and a Clock-aware
  `eventually` helper.
