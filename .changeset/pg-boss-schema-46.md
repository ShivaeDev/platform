---
"@shivaedev/effect-pg-boss": patch
"@shivaedev/create-app": patch
---

### Changed

- Require pg-boss 12.38.0 and generate applications with the matching @pg-boss/dashboard 1.12.0.

### Fixed

- Support schema 46 in the PostgreSQL expiry test controls, preserving native supervision and dead lettering.
