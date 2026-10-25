---
"@shivaedev/quality": patch
---

### Fixed

- `tests/no-expect-in-support` no longer reports test files that a nested Vitest run executes: unimported test-support files that register tests at module top level.
