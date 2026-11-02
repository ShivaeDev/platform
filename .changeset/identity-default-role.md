---
"@shivaedev/identity": minor
---

### Added

- Reject an undeclared `defaultRole` when mounting Better Auth with a role set. Startup fails with a typed `UndeclaredDefaultRole` error that names the role instead of assigning it to new users.
