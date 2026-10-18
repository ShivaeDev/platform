---
"@shivaedev/test-story": minor
"@shivaedev/effect-test": minor
---

### Added

- Pass a UTC `DateTime` to the existing `clock` option to pin a story or Effect fixture before its per-test setup runs. The exported `EffectClock` type now accepts `DateTime.Utc` alongside `"test"` and `"live"`. Hosts, workers and screens acquired with the story's Effect Context share native `Clock` / `TestClock`, including explicit `TestClock.adjust` advances; application code using `Clock` or `DateTime.now` needs no changes.
