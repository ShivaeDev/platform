---
"@shivaedev/identity": patch
---

### Changed

- Support externally migrated Better Auth tables as a transition to identity's frozen auth migrations. Run `assertBetterAuthSchema` before `betterAuthMount` at startup to refuse schema drift with typed diagnostics naming missing tables or columns.
