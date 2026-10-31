---
"@shivaedev/test-story": minor
---

### Added

- `watchedClock` publishes sleep starts from the native TestClock. Stories use it automatically with a test clock, wait for a matching sleep with `untilTimer`, and advance time while awaiting completion with `passes(interval, then)`.
