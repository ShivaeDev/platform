---
"@shivaedev/pr-watch": minor
"@shivaedev/work-fleet": patch
---

### Added

- `@shivaedev/pr-watch`: Export discriminated `TransitionEvent`, `HealthEvent` and `WatchEvent` Schemas from `outputEvent.ts`, with `encodeJsonLine` for newline-terminated JSON output. Callback failures and service requirements remain visible in the engine's Effect types.

### Breaking

- `@shivaedev/pr-watch`: `events`, `Watcher.poll`, `watch`, `program`, `watchCommand`, `Emit`, `health` and `makeOutput` now pass typed event values instead of JSON strings. Consumers should accept `WatchEvent` values, remove JSON parsing, and use `encodeJsonLine` at output boundaries. `health` takes a discriminated fields object containing `event` instead of a kind and arbitrary fields.

### Changed

- `@shivaedev/work-fleet`: Consume pr-watch's typed events directly while preserving its combined watch output.
