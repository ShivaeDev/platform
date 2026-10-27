---
"@shivaedev/admin": minor
"@shivaedev/create-app": minor
---

### Added

- Admin pages declare domain permissions shared by RPC middleware and client route metadata. Generated apps declare one role per file, with explicit grants and one permission fallback page.
- Users with `roles.assign` assign a user's single role from the application's declared role set. Role changes cannot remove the final holder of that permission.

### Breaking

- Replace `OpenAdmin` and `AdminPermission` with each page's domain permission: `ReadUsers`/`UsersPermission` or `ReadJobs`/`JobsPermission`. Custom `adminPage` declarations must pass their own `permissionMiddleware` as `permission`; provide its `permissionLayer` at the server host and use `page.route.permission` with React's `permissionGuard` and `PermissionBoundary`.
- Replace the `UsersPage` singleton with `usersPage(AppAccess)` and register `usersHandlers(UsersPage, AppAccess)`. Pass `roles={AppAccess.Role.literals}` to `UsersView`. Server callers pass `AppAccess` first to `listUsers` and `changeUserRole`.
- Replace `ChangeUserRoles` with `AssignRoles` (`roles.assign`), and handle `LastRoleAssigner` instead of `LastOwner`. User results contain `role` instead of `roles`; `changeRole` takes `{ userId, role }` without `grant`. The fixed `UserRole` Schema is removed; use `AppAccess.Role`.
- Existing generated apps must migrate stored comma-separated roles to one declared role string before running the new app. Preserve every final role assigner's access during that data migration. Run the create-app updater to merge the starter's new role files, imports, server permission Layers and client permission boundary; resolve customized wiring conflicts and install dependencies. The updater does not migrate database values. Bootstrap now creates one `owner` role, whose explicit grants include access to all admin pages.
