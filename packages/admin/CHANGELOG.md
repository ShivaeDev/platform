# Changelog

## 0.17.0 - 2026-11-01

### Changed

- Identity operation spans use the `Identity` prefix, including `Identity.resolveSession` and `Identity.betterAuthSession`. Adjust trace queries that used `Platform` or `PlatformRpc` names.

### Breaking

- Identity reads `SessionPolicy` from the Effect environment. Import the service from `@shivaedev/identity/server/SessionPolicy.ts` and construct one `Layer.succeed(SessionPolicy, { origin, provider, roles, streamRevalidationInterval })`, omitting optional fields as needed. Replace `SessionPolicy<TSession>` annotations with `SessionPolicy["Service"]`; provider-specific types remain on `SessionProvider<TSession>`. Remove policy arguments from session middleware constructors, `resolveSession`, `withSessionUser`, `permissionLayer`, `permissionRoute`, session lookup, rechecks and stream revalidation; provide the policy Layer to the composed readers. Profiles and provider accounts are decoded at their middleware boundaries from the shared provider.
- Server's `appHost` `sessions` option accepts that Layer and supplies it to middleware, application routes, sockets and change subscriptions. Wrap the previous policy object in `Layer.succeed(SessionPolicy, policy)`. Remove the session-shape generic from host option and factory types, and remove the policy argument from `hostChanges` and `bearerSocketRpc`.
- Admin uses identity's `SessionPolicy` directly. Replace `AdminSessions` imports and Layers with the identity service, and provide the policy once through the host instead of separately to admin handlers and documents.
- MCP's `mcpRoutes` reads `SessionPolicy` from the environment. Remove its `sessions` option and the session-shape generic from `McpOptions`; `betterAuthMcp` now returns `sessions` as a policy Layer, which can be passed to the host or supplied to MCP routes with `HttpRouter.provideRequest(oauth.sessions)` when the host also serves cookie-authenticated RPC.

## 0.16.3 - 2026-11-01

### Changed

- Update `@shivaedev/access` from 0.3.4 to 0.3.5.
- Update `@shivaedev/contract` from 0.30.0 to 0.30.1.
- Update `@shivaedev/errors` from 0.4.0 to 0.4.1.
- Update `@shivaedev/identity` from 0.15.0 to 0.16.0.
- Update `@shivaedev/jobs` from 0.28.3 to 0.29.0.
- Update `@shivaedev/react` from 0.31.0 to 0.31.1.

## 0.16.2 - 2026-11-01

### Changed

- Update `@shivaedev/identity` from 0.14.0 to 0.15.0.
- Update `@shivaedev/jobs` from 0.28.2 to 0.28.3.
- Update `@shivaedev/react` from 0.30.1 to 0.31.0.

## 0.16.1 - 2026-10-31

### Changed

- Update `@shivaedev/identity` from 0.13.0 to 0.14.0.
- Update `@shivaedev/jobs` from 0.28.1 to 0.28.2.

## 0.16.0 - 2026-10-31

### Added

- Admin pages can declare a detail path under `route.detail`. `adminDocuments` and `adminPermissionGuard` use the registered page's permission for its list and detail paths.
- Identity permission layers accept native context keys for permission middleware.

### Fixed

- Generated apps use admin registration for permission layers and guard each admin document by its registered page.

### Breaking

- Admin registrations install their pages' permission middleware and require `AdminSessions` when their handler layer builds. Provide `Layer.succeed(AdminSessions, sessions)` once at the host instead of installing each page's `permissionLayer` by hand. Missing policy fails startup with the page id and permission name.
- Declare page middleware with identity’s `permissionMiddleware` so it provides `Identity` and `SessionUser` with the shared identity failures.
- Generated apps import `ReadStatistics` from `#ReadStatistics.ts` and `StatisticsPermission` from `#modules/notes/StatisticsPermission.ts`; migrate custom imports of `#appPermissions.ts` when applying the template update.

## 0.15.0 - 2026-10-31

### Added

- `migrateBetterAuth` runs Better Auth schema migrations using the database from Effect's SQL service. Applications pass auth configuration without a database pool.

### Fixed

- Generated applications start with no quality baseline and rely on the jobs package’s peer installation of `pg-boss`.
- Loaded editors construct their form from the supplied row without an unreachable synchronous guard.

### Breaking

- `registerAdmin` reports missing or extra page handlers as defects when its handler Layer is built. Consumers that catch synchronous registration errors must instead observe Layer acquisition failures.

## 0.14.0 - 2026-10-31

### Added

- Jobs Layers accept `retired` queue names, deleting their queues and schedules before registering current workers once the database release is active. Dead-letter queues remain unless explicitly retired. Custom clients can expose native `deleteQueue` and `unschedule` capabilities.
- Jobs health accepts explicit queue names. Jobs admin pages use their declared names for health and accept a browser-safe `{ name }` entry for schedules registered only by a worker, with null payloads for their runs.

## 0.13.0 - 2026-10-31

### Added

- `JobsView` from `@shivaedev/admin/client/JobsView.ts` renders failed and dead-lettered jobs, readable failure summaries, health, counts, pagination and detail using the application's bound Jobs client and shared queue names. An optional native retry action enables retry for failed originals; the Jobs page's grants remain enforced by its host.
- Provide `SessionsPage` and `SessionsView` using identity's session administration calls and permission, with session timestamps, an own-session marker and inline revoke confirmation. Applications supply the current session id and sign-out callback.
- Generated starters mount the Sessions admin page and sign out after revoking the current session.
- Jobs dead-letter entries and admin Jobs RPC responses carry `sourceQueue`, the name of the original queue.
- Jobs encode and decode durable payloads through Effect's JSON codec, so native `Schema.Redacted` fields reach workers with their real values.
- Contract exports the `signedIn` read policy and `validateReadPolicies(group)` for native hosts to validate their RPC group during Layer construction.

### Changed

- Generated starters use the shared admin Jobs view and include its styles from both standalone and workspace installs.

### Fixed

- Successful jobs clear their dead-letter copies in the completion transaction. Copies of unretried jobs and failed retries remain listed. Schema installation also clears copies whose retained source already completed.
- Job inspection and worker logs mask native `Redacted` values and fields recognized by the errors package's sensitive-key policy. The admin Jobs page carries masked inspection data over RPC without re-encoding it through the payload schema.
- Admin's built-in Users and Jobs queries and Work Board's daemon diagnostics queries explicitly declare read policies; existing permission and loopback boundaries continue to own access.

### Breaking

- Consumers constructing `DeadLetteredJob` values or admin dead-letter responses must supply `sourceQueue`. Applications using `migrate: false` must run `installPgBossSchema` during upgrade to install the completion trigger.
- Jobs `getJob`, `failedJobs` and `deadLetteredJobs`, and admin Jobs RPC results, now return masked `data: unknown` instead of a typed worker payload. Consumers must treat this as diagnostic data and narrow it before reading fields; obtain operational payloads in queue handlers. Admin RPC no longer applies the queue's payload encoding or requires its encoding services for results.
- Every contract query requires a `readPolicy`, including plain RPC reads. Add `readPolicy: signedIn` for any signed-in viewer, an explicit `() => Effect.succeed(true)` for public reads, or an application policy for restricted reads. Plain calls without a policy now fail closed with `MissingReadPolicy` even on native servers that bypass startup validation.
- The application server Layer fails with typed `MissingReadPolicies` before listening when untyped queries omit policies. Handle this boot error if your application narrows startup failures; its `queries` field lists every affected RPC. Query atom error types now follow their native RPC errors without an extra client-side `MissingReadPolicy` branch. Custom `ChangesQueries` annotations must now include their query definitions in `queries` alongside `resolve`.

## 0.12.3 - 2026-10-31

### Changed

- Update `@shivaedev/contract` from 0.26.0 to 0.27.0.
- Update `@shivaedev/identity` from 0.10.0 to 0.10.1.
- Update `@shivaedev/jobs` from 0.24.0 to 0.25.0.
- Update `@shivaedev/react` from 0.26.0 to 0.27.0.

## 0.12.2 - 2026-10-31

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.
- Server RPC failures, request diagnostics and traces use the sensitive keys from their own RPC schemas, so registering another RPC cannot redact their public failure tags or messages.
- Admin Jobs schemas mark job payload and failure-detail containers sensitive without marking generic `_tag` or `message` fields sensitive.

## 0.12.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.12.0 - 2026-10-30

### Added

- Access exports `AssignRoles` and `LastRoleAssigner` from `@shivaedev/access/roles.ts` for shared role policy declarations.
- Identity provides `assignRole(access, userId, role)` for trusted seeds and operator commands. Supply `SqlClient` and `Reactivity`; it returns whether storage changed and uses the Users page's PostgreSQL lock, last-role-assigner guard and commit invalidation.

### Breaking

- Identity mounts with `roles` close Better Auth's `/admin/set-role`, `/admin/update-user` and `/admin/create-user` HTTP endpoints and set its admin plugin's `adminRoles` to `[]`. Remove that setup from applications. Use the admin Users page for authorized requests and identity's `assignRole` for trusted server commands.
- Admin consumers import `AssignRoles` and `LastRoleAssigner` from `@shivaedev/access/roles.ts` instead of `@shivaedev/admin/permissions.ts` and `@shivaedev/admin/users/roles.ts`. The Users page uses identity's shared assignment operation; its permission checks, typed refusal and audit log remain.

## 0.11.2 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.11.1 - 2026-10-30

### Fixed

- Stack UsersView users as labelled cards below 640px so role controls fit on phone screens, while retaining the desktop table.

## 0.11.0 - 2026-10-30

### Fixed

- Live reads and change subscriptions preserve policy failures instead of reporting read denial. Generated starter apps report notes database connection failures as `ServiceUnavailable` during the owner's live read.

### Breaking

- Query read policies declare their error and service channels with `QueryReadPolicy<Payload, E, R>`. Declare policy errors in the query's `rejections` and provide policy services when building its handler Layer. Custom subscription adapters call `querySubscription(rpc, references, viewer)` instead of resolving requests themselves. Use the native RPC type when calling `authorizeReads` or `resolveChanges` so their inferred channels include policy requirements and errors. The generated change stream includes the queries' declared rejections and service requirements; consumers handling that stream must handle those errors too.
- Admin pages install their permission's read policy for every query, preserving additional query restrictions. Remove repeated page-grant policies from individual queries and supply the page's permission middleware with the handler Layers.

## 0.10.2 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.10.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

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
