---
"@shivaedev/test": patch
---

### Fixed

- Interrupt pending file Layer acquisition when its test times out and run registered finalizers before file completion without unhandled rejections. Fixture tests, `it.effect` and `it.live` share a five-second cleanup limit and `TestScopeCloseTimeout` error.
