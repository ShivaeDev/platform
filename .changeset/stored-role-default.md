---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- Generated applications mount roles through identity, migrate the stored default through a numbered migration, and bootstrap the first owner through `assignRole`.
- Declare the user role field and its sign-up default through identity, and adopt existing users with `migrateBetterAuth(options, { defaultRole })` without an application backfill. Fresh and upgraded PostgreSQL schemas have the same non-null text column and database default.
- Let identity's database story kit migrate schemas with or without roles, inspect the stored role column and user roles, and model a missing role.

### Fixed

- Refuse missing stored roles with `Forbidden` and log the migration fix instead of failing requests with a defect.

### Breaking

- Pass `defaultRole` alongside `roles` to `betterAuthMount`. Remove application-owned role `additionalFields` and Better Auth's `admin()` plugin if it was only supplying roles. Add and run a numbered `migrateBetterAuth(options, { defaultRole })` migration before deploying, then bootstrap administrators through `assignRole`.
