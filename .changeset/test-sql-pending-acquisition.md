---
"@shivaedev/test-sql": patch
---

### Fixed

- Allow rollback tests to be interrupted while waiting for a pooled connection without turning interruption into a failure.
- Include the lock holder's connection acquisition in a race's lock-taking timeout.
