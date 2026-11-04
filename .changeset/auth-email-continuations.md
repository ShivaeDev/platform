---
"@shivaedev/identity": minor
"@shivaedev/rate-limit": minor
---

### Added

- `@shivaedev/identity`: Auth emails accept per-kind `windows` overrides, falling back to the existing `window` and its one-minute default.
- `@shivaedev/rate-limit`: The PostgreSQL story fixture exposes `elapseWindows(duration)` to age stored reservations without waiting on wall time.

### Fixed

- `@shivaedev/identity`: Preserve Better Auth email continuations in the app link's `callbackURL`, accepting only continuations on the configured app route's origin.
