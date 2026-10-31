---
"@shivaedev/admin": minor
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- Admin pages can declare a detail path under `route.detail`. `adminDocuments` and `adminPermissionGuard` use the registered page's permission for its list and detail paths.
- Identity permission layers accept native context keys for permission middleware.

### Fixed

- Generated apps use admin registration for permission layers and guard each admin document by its registered page.

### Breaking

- Admin registrations install their pages' permission middleware and require `AdminSessions` when their handler layer builds. Provide `Layer.succeed(AdminSessions, sessions)` once at the host instead of installing each page's `permissionLayer` by hand. Missing policy fails startup with the page id and permission name.
- Declare page middleware with identity’s `permissionMiddleware` so it provides `Identity` and `SessionUser` with the shared identity failures.
- Generated apps import `ReadStatistics` from `#ReadStatistics.ts` and `StatisticsPermission` from `#modules/notes/StatisticsPermission.ts`; migrate custom imports of `#appPermissions.ts` when applying the template update.
