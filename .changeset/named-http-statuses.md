---
"@shivaedev/quality": minor
---

### Breaking

- Bare HTTP status literals in tests are now reported by `tests/named-values`. Import `HttpStatus` from `effect/http/HttpStatus` and write `HttpStatus.fromLiteral("NotFound")` instead of `404`. Subjects named `status` or `code` no longer exempt numeric assertions; process `exitCode` literals remain accepted.

### Fixed

- Pure unit tests can import `effect/http/HttpStatus` without being reported as network I/O; HTTP client imports still require a story.
