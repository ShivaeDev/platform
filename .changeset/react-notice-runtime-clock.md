---
"@shivaedev/react": minor
---

### Added

- `NoticeHost` accepts an optional `runtime` and runs notice expiry as an Effect sleep on that atom runtime's `Clock`, so a story's `TestClock` drives expiry. Without it, expiry uses Effect's default clock as before.
