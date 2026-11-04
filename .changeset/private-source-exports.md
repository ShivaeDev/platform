---
"@shivaedev/quality": patch
---

### Fixed

- Accept source-only file-preserving wildcard exports for packages with `"private": true`. Published packages still require source, types and dist mappings, and every package must keep `#test/*` rooted at `./src/test-support/*`.
