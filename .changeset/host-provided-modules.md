---
"@shivaedev/quality": patch
---

### Changed

- Recognize ambient runtime modules in their declaring TypeScript project when checking missing package dependencies, including generated JavaScript clients. Undeclared dependencies and declarations outside that project still fail.
