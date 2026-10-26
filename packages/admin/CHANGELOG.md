# Changelog

## 0.5.0 - 2026-10-26

### Added

- Access role sets resolve stored role strings into their decoded role and declared permissions.
- Platform resolves application roles per request, exposes grants to handlers and the client session, and enforces declared permissions on RPCs and HTTP routes.

### Breaking

- Platform removes `requireAdmin`, `hasRole`, `AuthenticatedAdmin`, `AuthenticatedOwner`, their Layers, and `adminRoute`. Declare roles and permissions with `@shivaedev/access`, pass the role set once in `betterAuthMount(options, { roles })` and reuse its returned `sessions`, or configure `sessions.roles` for another provider. Replace role middleware with a class extending `permissionMiddleware<Self>()(id, permission)`, provide `permissionLayer(Middleware, sessions)`, and use `permissionRoute(sessions, permission)` for HTTP routes. Read `SessionUser.permissions` or the client session's `user.permissions` with `hasPermission`; use the application's access policy for record ownership. Unknown stored roles fail visibly and must be migrated to declared strings.
- Admin pages require `AdminPermission` from `@shivaedev/admin/permissions.ts`. Grant its `OpenAdmin` permission to the application's operator roles and provide `permissionLayer(AdminPermission, sessions)`. User role writes and controls require Platform's `ChangeUserRoles` permission. The existing admin role-list editor and last-owner invariant retain their storage format; declare its stored combinations in the application role set until migrating that editor.

## 0.4.0 - 2026-10-26

### Added

- Add the admin Users page, native RPC handlers and React view for paginated app users and owner-managed roles. Register `UsersPage` with `usersHandlers` beside Jobs and mount `UsersView` using its bound query and role action.
- Add Platform auth user listing and transactional role changes on the existing Better Auth PostgreSQL schema, with typed owner-only and last-owner failures, change invalidation and actor/timestamp logs.
- Mount Users in the starter and generated apps. Existing apps receive the wiring with `pnpm dlx @shivaedev/create-app@latest update` after these packages are released; review template conflicts and install dependencies. Newly bootstrapped administrators also hold the owner role.
- Provide the shared expected failure schemas and `rejectedField` in `@shivaedev/effect-contract/errors/`, so browser-safe contract consumers can use them without depending on Platform. Tags, schema fields and RPC encoding remain the same.

### Breaking

- Move all imports from `@shivaedev/platform/errors/taxonomy.ts` to `@shivaedev/effect-contract/errors/taxonomy.ts`, and from `@shivaedev/platform/errors/rejectedField.ts` to `@shivaedev/effect-contract/errors/rejectedField.ts`. The old modules are removed. Add a direct `@shivaedev/effect-contract` dependency if the consuming package does not already declare one. Admin, GitHub, Work Board and Work Fleet public failure types now refer to these shared classes.
- Generated apps use the new imports. The create-app updater applies the starter changes through its usual three-way patch; it does not rewrite imports in app-owned files. Replace both old import paths above in those files when upgrading existing apps.

## 0.3.0 - 2026-10-25

### Added

- Add an explicitly retry-enabled Jobs page and handlers for registered failed originals, with administrator-only RPC access and query invalidation after retry.

## 0.2.0 - 2026-10-25

### Added

- `@shivaedev/admin` provides a query-only Jobs page with explicitly registered queues, payload codecs, health, counts, paginated failed and dead-lettered jobs, and job lookup through the protected admin RPC group. Jobs failures remain declared and do not prevent other pages from serving requests.
- `@shivaedev/effect-pg-boss` job reads accept a queue's name and payload Schema without requiring its worker configuration.

## 0.1.5 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.4 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.3 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.2 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.1 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.0 - 2026-10-25

### Added

- Declare admin pages with native Effect contracts protected by `AuthenticatedAdmin`, including generated change subscriptions. Merge pages into one registry with unique ids, paths and RPC tags, and register one typed handler Layer per page for the existing RPC host.
