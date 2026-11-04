---
"@shivaedev/quality": patch
---

### Fixed

- Follow story specs' runtime imports into test-support when reporting sleeps, polling, quiet windows, fake timers and `eventually`. Keep product timers and controlled kit clock advances accepted, and explain that a deadline bounds a failure but does not prove completion.
