---
"@shivaedev/test-story": patch
---

### Fixed

- Cancel timers armed in the DOM environment before removing its globals, so Better Auth's delayed session cleanup cannot access a removed `window`.
