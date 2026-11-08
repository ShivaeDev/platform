---
"@shivaedev/quality": patch
---

### Changed

- `effect/adapter-imports` accepts value imports of `node:path`, `node:path/posix` and `node:path/win32` in every file, because path functions only compute strings. File-system, process and other Node builtins still need an `adapters/` module.
