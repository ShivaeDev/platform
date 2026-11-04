---
"@shivaedev/identity": minor
---

### Added

- Compose domain-owned user data export registrations into one typed account export. Check PostgreSQL foreign keys before exporting and report user-referencing tables that have no registration.
- Register Better Auth profile, linked-account and session data for export without passwords or authentication tokens.
