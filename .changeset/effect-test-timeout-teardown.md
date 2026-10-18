---
"@shivaedev/effect-test": patch
---

### Fixed

- Wait for an interrupted test's Scope to close after its Vitest timeout, so application workers and database pools finish teardown before the next test starts. Keep the timeout as the test failure without leaking the interrupted program's rejection as an uncaught error.
