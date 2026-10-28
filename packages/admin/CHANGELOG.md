# Changelog

## 0.8.0 - 2026-10-28

### Added

- Register schedule definitions beside queues on the admin Jobs page, with null payloads in failed runs, dead-letter listings and job lookups. Pages with no queues can register handlers and serve health.
- Read stored jobs with null payload schemas through the jobs service without changing queue payload validation.
- Show an empty state in the starter Jobs view when no queues or schedules are registered.

### Fixed

- Enforce declared query read policies at the hosted RPC handler boundary, including contracts without identity middleware, whose viewer is anonymous. Query RPC error schemas include `QueryReadDenied` so native clients receive typed refusals before handlers run.
- Keep collection methods and untyped schema internals from making data parameters appear to carry callable services. Direct service implementations, nested dependency fields and service arrays remain subject to `effect/service-parameters`.

### Breaking

- Move key imports from `@shivaedev/contract/keys.ts` to `@shivaedev/changes/keys.ts`. Declare bucket fields with `collection(name, idSchema, fields)` and publish affected buckets alongside record keys.
- Replace collection policy maps, `mergeReadPolicies`, `ReadPolicy` and `ReadPolicyMemoWindow` with each query's `readPolicy(payload, viewer)`. Declare the same query's live scope with `reads(payload, viewer)`. Bound query atoms and subscriptions refuse missing policies with a declaration error; one-off query `run` calls remain available. Denied queries refuse the entire subscription. Server adapters replace `QueryReads` and `ChangesReads` with `QueryDefinition` and `ChangesQueries`. Custom middleware calls `authorizeReads(effect, request, viewer)` and declares `MissingReadPolicy` and `QueryReadDenied` errors.
- Custom subscription adapters yield `ChangesQueries.resolve(references)`, call `querySubscription(requests, viewer)` and pass the authorized result to `makeLiveServer.subscribe(subscription, context)`. Metadata values expose `QueryDefinition.definition` and `CommandInvalidation.invalidates` instead of bare definitions and callbacks. Yield the Effect returned by `queryKeys(queries, references)` when projecting keys for a custom stream. `resolveChanges` supplies the authorized subscription in hosted applications. Changed hints can carry query positions so bindings can rerun session-scoped reads without deriving session scopes in the browser.
- Remove `appHost`'s `readPolicy` option and module policy registration. Session and permission middleware apply query policies using the current session viewer. Handle the new typed policy errors in native clients, including `QueryReadDenied` on query RPCs without identity middleware; widen explicit query error annotations accordingly.
- Replace `sessionCommandChanges` with `commandChanges` for custom session middleware. Command invalidation callbacks can receive the session viewer as their third argument. Announce viewer buckets there; background writers must explicitly publish those bucket keys after commit.
- Built-in admin queries declare their permission policies alongside their schemas and read scopes. Consumers keep supplying the existing session and permission middleware layers.
- Local Work Board and Fleet queries declare their existing loopback read access explicitly so their generated live subscriptions remain available.

## 0.7.0 - 2026-10-27

### Added

- Admin pages declare domain permissions shared by RPC middleware and client route metadata. Generated apps declare one role per file, with explicit grants and one permission fallback page.
- Users with `roles.assign` assign a user's single role from the application's declared role set. Role changes cannot remove the final holder of that permission.

### Breaking

- Replace `OpenAdmin` and `AdminPermission` with each page's domain permission: `ReadUsers`/`UsersPermission` or `ReadJobs`/`JobsPermission`. Custom `adminPage` declarations must pass their own `permissionMiddleware` as `permission`; provide its `permissionLayer` at the server host and use `page.route.permission` with React's `permissionGuard` and `PermissionBoundary`.
- Replace the `UsersPage` singleton with `usersPage(AppAccess)` and register `usersHandlers(UsersPage, AppAccess)`. Pass `roles={AppAccess.Role.literals}` to `UsersView`. Server callers pass `AppAccess` first to `listUsers` and `changeUserRole`.
- Replace `ChangeUserRoles` with `AssignRoles` (`roles.assign`), and handle `LastRoleAssigner` instead of `LastOwner`. User results contain `role` instead of `roles`; `changeRole` takes `{ userId, role }` without `grant`. The fixed `UserRole` Schema is removed; use `AppAccess.Role`.
- Existing generated apps must migrate stored comma-separated roles to one declared role string before running the new app. Preserve every final role assigner's access during that data migration. Run the create-app updater to merge the starter's new role files, imports, server permission Layers and client permission boundary; resolve customized wiring conflicts and install dependencies. The updater does not migrate database values. Bootstrap now creates one `owner` role, whose explicit grants include access to all admin pages.

## 0.6.0 - 2026-10-27

### Added

- Own the app-user modules that lived in Platform: `users/roles.ts` holds the `user`, `admin` and `owner` roles, the browser-safe user schemas, `ChangeUserRoles` and `LastOwner`, and `server/users.ts` holds `listUsers` and `changeUserRole`.

### Changed

- Depend on `@shivaedev/identity`, `@shivaedev/errors`, `@shivaedev/access`, `@shivaedev/contract` and `@shivaedev/sql` instead of `@shivaedev/platform`.

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
