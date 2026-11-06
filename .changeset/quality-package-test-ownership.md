---
"@shivaedev/quality": patch
---

### Fixed

- Classify package-owned `test/` trees beside `src/` and private workspace packages consumed only by tests as development code for dependency, test-import and line-limit checks. Production consumers keep composition packages in the production boundary.
- Recognise package-owned test suites as covering their package's source tree, and allow pure matchers and readers beside specs while keeping setup and action helpers in story kits.
