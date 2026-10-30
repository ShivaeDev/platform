# Changelog

## 0.10.0 - 2026-10-30

### Added

- Access exports the `Permission` Schema and derives its type from it. Role resolution and identity session decoding use that Schema.
- Access exports `forbidden(permission)` and `unauthorized()` from `refusal.ts` for consistent permission refusals.
- Jobs services share one scoped pg-boss client through the Effect environment. Registration, worker and producer Layers use the same connection and pool settings.
- Service definitions accept marked generic methods alongside declared dependencies. Generic signatures retain their caller requirements unchanged; initialization can capture declared dependencies as private state.

### Changed

- User reads validate rows with `SqlSchema` using the shared `AppUser` fields. User operation spans are named `Admin.listUsers` and `Admin.changeUserRole`; adjust trace filters that used the `Platform` names.

### Fixed

- Retry wake-up reads run within the worker scope and log redacted failures without failing other jobs in the batch or spending their retries.
- Default pg-boss client error logs redact secrets in messages through `@shivaedev/errors`.

### Breaking

- Retrying failed jobs now requires `RetryJobs` (`jobs.retry`) in addition to `ReadJobs` (`jobs.read`). Add `RetryJobs` from `@shivaedev/admin/permissions.ts` to application roles that should keep retrying jobs; roles with only `ReadJobs` can still inspect jobs but receive `Forbidden` when retrying.
- `AppUser` now decodes PostgreSQL `Date` timestamps into UTC `DateTime` values. Direct Schema callers must pass a `Date` for `createdAt`; use `Schema.toCodecJson(AppUser)` when decoding or encoding JSON timestamps. Native RPC keeps ISO strings on the wire and UTC `DateTime` values for callers.
- Jobs handler failures persist only `JobFailure` (`_tag` and a redacted `message`); failed and dead-letter listings and admin job responses expose that shape or `null`. Consumers can import the shared `JobFailure` Schema from `@shivaedev/jobs/JobFailure.ts` and must read these fields instead of arbitrary error properties, stacks or causes. Older and native pg-boss failures without a tag decode with `_tag: "Error"`, and their messages are redacted when read; outputs without a string message fail decoding.
- Jobs listings reject invalid page limits and cursors with `SchemaError`; consumers must handle it alongside `PgBossError` and `PgBossPayloadError`. Admin listings report these inputs as `BadRequest`; clients must handle that rejection instead of `JobsUnavailable`.
- Access, identity and React now share access's grant evaluator: an `any` grant covers an `own` check for the same permission name. An `own` grant still cannot cover an `any` check. Applications that need separate capabilities must declare separate permission names; record ownership checks still belong in `canAccess` or `requireAccess`.
- Replace `Access.requirePermission(user, permission)` with `requirePermission(yield* Access.resolve(user.role), permission)` from `@shivaedev/access/requirePermission.ts`. The new function takes a signed-in user; reject an absent session with `unauthorized()` from `@shivaedev/access/refusal.ts` before resolving its role. `requireAccess` continues to handle signed-out users itself.
- Replace identity's `requirePermission(permission)` with access's `requirePermission(yield* SessionUser, permission)`. There is no identity re-export. Admin's built-in handlers use this shared enforcement.
- Access's `requireAccess` now uses the shared permission refusal message, `Permission required: <name> (<strength>)`, instead of `Access denied: <name>`. Consumers should branch on the `Forbidden` tag.
- Move connection, pool, client factory, cache key and stop options from each `Jobs.layer` call into one `pgBossLayer` from `@shivaedev/jobs/server/service.ts`. Supply `connectionString` as `Redacted<string>` and provide that Layer to the merged jobs services. Keep only `jobs` and `onError` in `Jobs.layer`.
- Call `jobs.health()` instead of yielding `jobs.health`. Custom jobs service implementations must expose health as a method. Admin's built-in jobs handlers call the method automatically. Jobs services passed to webhook routes and enqueue helpers must also implement the new method shape.
- Identity treats an undeclared stored user role as a defect naming the role, rather than `AuthUnavailable`. RPC request tracing logs the defect and Better Auth's session endpoint returns HTTP 500. Consumers must correct the user's stored role or restore its application declaration; reserve `AuthUnavailable` handling for provider outages.
- Admin role assignment trusts its typed role input and leaves session role resolution to identity. RPC consumers need no change: the contract decodes the role. Direct callers of `changeUserRole` must decode untrusted role input with the application's `Role` schema before calling it.

## 0.9.0 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

### Breaking

- `@shivaedev/admin`: Move page declarations and `registerAdmin` handler maps into their owning modules. Combine their registries with `mergeAdminRegistries` in browser composition and their registrations with `mergeAdminRegistrations` in the application host. Registration now exposes its pages; duplicate page ids are rejected by TypeScript as well as at runtime. Keep each module's handler Layer with its page registration.
- `@shivaedev/create-app`: The starter foundation owns Users and Jobs, and notes registers only its statistics page. Move application pages and handlers into their owning module registrations and combine them at the host; client modules contribute navigation through their own registry. Run `create-app update` to merge the starter side, preserving application customizations through its normal merge flow. Minimal apps retain Users and Jobs when notes is removed.

## 0.8.2 - 2026-10-29

### Changed

- Release with updated workspace dependencies.

## 0.8.1 - 2026-10-29

### Changed

- Release with updated workspace dependencies.

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
