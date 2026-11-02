---
"@shivaedev/identity": minor
"@shivaedev/access": minor
"@shivaedev/admin": minor
"@shivaedev/create-app": minor
---

### Added

- Identity owns the `UserDirectory` port for paged users, role reads and guarded assignments, and account names. Provide `betterAuthUserDirectory` with the application's role set, SQL Layer and Better Auth options to honour custom models and field mappings.
- Identity exports `userKeys` and `roleKeys` from `@shivaedev/identity/users.ts`. Role assignments publish the affected user and role keys after commit. Admin's Users queries now read identity's user keys. Generated apps import role declarations from identity.

### Breaking

- Import `AssignRoles` and `LastRoleAssigner` from `@shivaedev/identity/roles.ts` instead of `@shivaedev/access/roles.ts`, adding `@shivaedev/identity` as a direct dependency when needed. The access module is removed without a compatibility alias; access retains pure grant evaluation.
- Consumers observing the former `admin.users` change collection must read `userKeys.list` or `userKeys.item(userId)` from identity. Role readers can use `roleKeys.item(userId)`. Pass these typed keys through `readKeys` when subscribing directly to Reactivity.
