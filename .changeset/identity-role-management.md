---
"@shivaedev/access": minor
"@shivaedev/identity": minor
"@shivaedev/admin": minor
---

### Added

- Access exports `AssignRoles` and `LastRoleAssigner` from `@shivaedev/access/roles.ts` for shared role policy declarations.
- Identity provides `assignRole(access, userId, role)` for trusted seeds and operator commands. Supply `SqlClient` and `Reactivity`; it returns whether storage changed and uses the Users page's PostgreSQL lock, last-role-assigner guard and commit invalidation.

### Breaking

- Identity mounts with `roles` close Better Auth's `/admin/set-role`, `/admin/update-user` and `/admin/create-user` HTTP endpoints and set its admin plugin's `adminRoles` to `[]`. Remove that setup from applications. Use the admin Users page for authorized requests and identity's `assignRole` for trusted server commands.
- Admin consumers import `AssignRoles` and `LastRoleAssigner` from `@shivaedev/access/roles.ts` instead of `@shivaedev/admin/permissions.ts` and `@shivaedev/admin/users/roles.ts`. The Users page uses identity's shared assignment operation; its permission checks, typed refusal and audit log remain.
