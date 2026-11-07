---
"@shivaedev/quality": patch
---

### Fixed

- `code/unused`: Resolve `import.meta.dirname`, `__dirname` and `fileURLToPath(import.meta.url)` in build and spawn scripts from the repository root, so entries of a workspace package's bundler or child-process script are no longer resolved under a doubled package folder and reported as unused with everything they import.
