---
"@shivaedev/identity": minor
"@shivaedev/access": minor
"@shivaedev/admin": minor
"@shivaedev/create-app": minor
---

### Added

- `@shivaedev/identity`: Add the `UserDirectory` port for paged users, role reads and guarded assignments, and account names. Provide `betterAuthUserDirectory` with the application's role set, SQL Layer and Better Auth options to honour custom models and field mappings.
- `@shivaedev/identity`: Export `userKeys` and `roleKeys` from `@shivaedev/identity/users.ts`. Role assignments publish the affected user and role keys after commit.

### Breaking

- `@shivaedev/access`: Import `AssignRoles` and `LastRoleAssigner` from `@shivaedev/identity/roles.ts` instead of `@shivaedev/access/roles.ts`, adding `@shivaedev/identity` as a direct dependency when needed. The access module is removed without a compatibility alias; access retains pure grant evaluation.
- `@shivaedev/identity`: Consumers observing role assignments through the former `admin.users` change collection must read `userKeys.list` or `userKeys.item(userId)` from identity. Role readers can use `roleKeys.item(userId)`. Pass these typed keys through `readKeys` when subscribing directly to Reactivity.
- `@shivaedev/admin`: Users queries now read identity's user keys. Migrate custom Users subscriptions from the `admin.users` change collection to `userKeys.list` from `@shivaedev/identity/users.ts`.
- `@shivaedev/create-app`: Generated apps import role declarations from identity. Update customized starter role declarations to import `AssignRoles` from `@shivaedev/identity/roles.ts` instead of `@shivaedev/access/roles.ts`.
