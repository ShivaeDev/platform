---
"@shivaedev/admin": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/admin`: Admin no longer exports `AppUser`, `UserListInput` or `UserList` from `@shivaedev/admin/users/roles.ts`. Import `DirectoryUser` (in place of `AppUser`), `UserListInput` and `UserList` directly from `@shivaedev/identity/users.ts`. The page-specific `UsersList` response remains in `@shivaedev/admin/users/page.ts`.
- `@shivaedev/admin`: Import `ChangeRoleInput` from `@shivaedev/admin/users/ChangeRoleInput.ts` instead of the removed `@shivaedev/admin/users/roles.ts` module.
- `@shivaedev/admin`: Admin's `usersHandlers` now takes only the users page. Replace `usersHandlers(page, access, authOptions)` with `usersHandlers(page)` and provide identity's `UserDirectory` service, such as `betterAuthUserDirectory(access, authOptions)` from `@shivaedev/identity/server/better-auth/adapters/userDirectory.ts`, to the handlers.
- `@shivaedev/admin`: Admin's `listUsers` and `changeUserRole` in `@shivaedev/admin/server/users.ts` now take only their input. Replace `listUsers(access, input, authOptions)` and `changeUserRole(access, input, authOptions)` with `listUsers(input)` and `changeUserRole(input)`, and provide the same `UserDirectory` layer. Permissions remain enforced through `SessionUser`.

### Changed

- `@shivaedev/create-app`: Generated applications provide identity's user directory for admin user lists, pagination and role changes.
