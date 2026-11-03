---
"@shivaedev/create-app": patch
"@shivaedev/jobs": patch
---

### Changed

- `@shivaedev/create-app`: Generated apps compose server admin handlers and the Jobs inventory from the server feature list; browser registrations retain only page declarations, queue schemas and client bindings.

### Fixed

- `@shivaedev/jobs`: Preserve job module queue payload schemas and their Effect service requirements when composing queue inventories.
