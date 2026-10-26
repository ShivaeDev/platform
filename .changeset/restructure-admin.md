---
"@shivaedev/admin": minor
---

### Added

- Own the app-user modules that lived in Platform: `users/roles.ts` holds the `user`, `admin` and `owner` roles, the browser-safe user schemas, `ChangeUserRoles` and `LastOwner`, and `server/users.ts` holds `listUsers` and `changeUserRole`.

### Changed

- Depend on `@shivaedev/identity`, `@shivaedev/errors`, `@shivaedev/access`, `@shivaedev/contract` and `@shivaedev/sql` instead of `@shivaedev/platform`.
