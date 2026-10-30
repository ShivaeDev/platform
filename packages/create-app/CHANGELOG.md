# Changelog

## 0.26.0 - 2026-10-30

### Fixed

- Live reads and change subscriptions preserve policy failures instead of reporting read denial. Generated starter apps report notes database connection failures as `ServiceUnavailable` during the owner's live read.

### Breaking

- Query read policies declare their error and service channels with `QueryReadPolicy<Payload, E, R>`. Declare policy errors in the query's `rejections` and provide policy services when building its handler Layer. Custom subscription adapters call `querySubscription(rpc, references, viewer)` instead of resolving requests themselves. Use the native RPC type when calling `authorizeReads` or `resolveChanges` so their inferred channels include policy requirements and errors. The generated change stream includes the queries' declared rejections and service requirements; consumers handling that stream must handle those errors too.
- Admin pages install their permission's read policy for every query, preserving additional query restrictions. Remove repeated page-grant policies from individual queries and supply the page's permission middleware with the handler Layers.

## 0.25.2 - 2026-10-30

### Changed

- Generated apps use the latest released starter dependencies.

## 0.25.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.25.0 - 2026-10-30

### Added

- Export generator modules through `@shivaedev/create-app/*.ts` so tooling can reuse scaffolding, template packing and starter updates. Importing `pack.ts` leaves template generation to its direct command invocation.
- Expose the native submission `cause` on `useEditor`, `useCreate` and `SaveState` so applications can render failures that include defects.
- Identity's `trustedOrigins` accepts an optional `sameOrigin: { trustedProxy }` policy using the transport guard's loopback and trusted-proxy authority checks. Session resolution supplies the transport peer address; RPC message headers cannot establish proxy trust.

### Changed

- Generated applications import React test helpers from their existing `@shivaedev/test-story` development dependency.
- Generated notes apps derive live list and detail invalidations from repository writes, including word-count jobs, with the owner bucket declared on the stored model.
- Generated applications keep jobs connection strings redacted and provide one app pg-boss Layer to feature registrations, producers and workers, replacing per-feature connection arguments and Symbol cache keys.

### Fixed

- A failed initial commit names the Git command as `git commit -m 'Initialize a generated app'`, without the fallback identity flags.
- Ignore repeated sign-out dispatch while sign-out is pending.
- Generated apps send an explicitly signed-out visitor to sign-in when the replacement session receives `Unauthorized` from the notes route.
- Generated apps retain database failure causes, report constraint violations as conflicts, validate trimmed titles in their Schema, and show the session error screen for malformed session payloads.
- Keep template preparation and rendering failures as non-enumerable causes, name the failed step and file, and include the cause in CLI error logs.
- Generated apps accept their own forwarded HTTPS RPC requests without `PUBLIC_URL`, while refusing foreign origins. A configured `PUBLIC_URL` remains the explicit RPC origin allowlist.

### Breaking

- `useSignOut` stops follow-up navigation on component unmount or registry disposal. Keep the component mounted until the request completes, or let the replacement session's route policy navigate to sign-in when a session refresh unmounts it first.
- Move the React test helpers to `@shivaedev/test-story/client/react.ts`. Replace imports from `@shivaedev/react/client/testing.ts` with this path for `render`, `eventually`, `captureReactWarnings`, `expectNoReactWarnings` and their types. Add `@shivaedev/test-story` as a development dependency and install its React helpers' optional peers `react`, `react-dom` and `@effect/atom-react` when using them. React no longer brings `@shivaedev/test` into applications as a runtime dependency.
- Generated notes apps remove the test-only `notes.whoami` RPC. Read the viewer through identity's session API instead.
- Notes RPC callers decode raw titles with `NoteFields` or `NoteEditFields` before submitting; title validation now happens in the Schema. Handle database constraint rejections as `Conflict` and unexpected failures as `InternalServerError`.
- `appFile` validates `package.json` with the starter's concrete manifest schema. Use manifests from `packTemplate`, or supply the complete starter manifest shape with string-valued dependency, script, import and engine maps instead of arbitrary JSON objects.

## 0.24.0 - 2026-10-30

### Added

- Inspect running apps locally with browser-check screenshots, test-user sign-in and smoke checks, installing Chromium only when the command runs.
- Give generated apps an opt-in browser-check script and ignored screenshot folder, outside app CI and ready checks.
- Generated apps report coverage and JUnit from one stable `CI` job, uploading a `coverage-tests` artifact with commit and job metadata. CI skips draft pull requests, cancels superseded pull-request runs and preserves default-branch measurements. Existing apps receive the workflow through `create-app update`.
- Quality accepts app migrations referencing the auth user id with `ON DELETE CASCADE` or `ON DELETE SET NULL`, while keeping auth reads and writes behind identity.
- Identity exports `userReference` from `server/better-auth/userReference.ts` so app migrations share the user table and id column names.
- Starter notes use a `user_id` foreign key with cascading deletion. A numbered migration renames the existing ownership column and adds the constraint for existing apps.

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.
- `@shivaedev/create-app` omits unused chart and tooltip components and Recharts from generated apps, and removes the notes table dependency from minimal apps and their starter updates. Generated guidance explains Quality's test naming, the dev server forwards `/health`, and Railway workers use the default restart policy. Existing apps receive the removals through `create-app update`.
- The starter's Railway deployment supplies `TRUSTED_PROXY=100.64.0.0/10` and `AUTH_CLIENT_IP_HEADER=x-real-ip` through its shared proxy configuration. Generated deployment docs explain the automatic Railway settings and when a host refuses to boot.
- New apps include an outbound HTTP adapter example in the notes module, with stories covering success, error statuses and malformed bodies against a fake API.
- The `story-testing` skill covers how a story reads: one name per actor, actions that name their change, a proven before state, domain outcomes, a separated action, a true title, `outcomes` for several checks, explained setup, one behaviour per story, stories only for plausible regressions, and settling on events. It now applies to package stories as well as app stories.
- Generated apps record the starter's existing findings for the new story rules in their baseline.
- Quality applies Biome’s test-title check only to `*.test.*`, `*.spec.*` and `test-support/` files, so ordinary helpers named `describe`, `it` or `test` do not receive test-title findings.
- Quality and starter guidance explain that a `CreateSpace` component in `spaces/client/` is named `Create.tsx`, keeping the full export name without repeating a folder in the file name.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

### Breaking

- `@shivaedev/admin`: Move page declarations and `registerAdmin` handler maps into their owning modules. Combine their registries with `mergeAdminRegistries` in browser composition and their registrations with `mergeAdminRegistrations` in the application host. Registration now exposes its pages; duplicate page ids are rejected by TypeScript as well as at runtime. Keep each module's handler Layer with its page registration.
- `@shivaedev/create-app`: The starter foundation owns Users and Jobs, and notes registers only its statistics page. Move application pages and handlers into their owning module registrations and combine them at the host; client modules contribute navigation through their own registry. Run `create-app update` to merge the starter side, preserving application customizations through its normal merge flow. Minimal apps retain Users and Jobs when notes is removed.
- `@shivaedev/server` refuses to start a session host bound to a non-loopback address without proxy trust, with a typed `TrustedProxyRequired` error naming the missing setting. Set `TRUSTED_PROXY` to your proxy's peer IP addresses or CIDR ranges, set `config.trustedProxy`, or deploy with the starter's Railway configuration. Local loopback hosts keep working without it.
- Specs get new findings from three story rules. `tests/domain-outcomes` reports Effect `Exit`, `Cause` and `Result` uses, `_tag` reads and `"Success"` or `"Failure"` tagged literals: return the outcome in the domain's words from a kit verb or readout. `tests/grouped-outcomes` reports consecutive `expect(yield* …)` checks: write them as rows of one `outcomes` call from `@shivaedev/test-story/server/outcomes.ts`. `tests/wait-on-events` reports sleeps, timers, `eventually`, Vitest fake timers and `TestClock` adjustments: settle on the engine's own signal, and advance the clock in a kit verb named for the time that passes. Record existing findings with `quality baseline write --rule tests/domain-outcomes --rule tests/grouped-outcomes --rule tests/wait-on-events`.

## 0.23.0 - 2026-10-29

### Changed

- The Biome preset targets Biome 2.6.
- Generated apps format installed files before their initial commit.

### Breaking

- Starter server registrations now declare a `migrations` directory beside `group`, `handlers` and `services`. In existing apps, move each module’s migration directory into its registration, derive the combined loader from registered modules, and delete standalone module migration loaders. Keep migration numbers and the existing ledger unchanged.
- Replace host `jobsClientFactory` and worker `clientFactory` test options with `replacements: Layer.succeed(JobsClientFactory, testing.clientFactory)`. Compose other fake services into that same Layer; module service factories now receive the database URL and optional pool size. `create-app update` merges the starter side of these changes into existing apps for review.
- Starter test PostgreSQL clients now use the app’s camelCase name transforms; remove SQL aliases and `withoutTransform` workarounds from test-support queries that expect camelCase result fields.

## 0.22.0 - 2026-10-29

### Added

- Report unused files, exports and package dependencies, and missing dependencies with the knip-backed `code/unused` rule. Package exports, binaries, scripts, tests, stories and test support supply entry points without a knip config. Run `quality baseline write --rule code/unused` to record existing findings, then remove debt and run `quality baseline tighten` as you repair it.

### Fixed

- The application host constructs services, handlers and routes before listening, so startup connections are refused until requests can be answered.
- Server and HTTP modules import Node platform modules directly to avoid loading Redis during startup.
- Generated apps import Node platform modules directly, and deployment stories allow enough time for their sequential cold processes without a fixed timeout on each startup health probe.
- Keep the minimal generated app on the unused-code gate with its own baseline of existing template debt.

## 0.21.0 - 2026-10-28

### Added

- Application HTTP routes registered through `appHost.routes` can use app services, with route construction errors and missing dependencies retained in the host's types. Generated apps register HTTP routes and static assets through this option.
- Application routes can answer foreign-origin preflights through native `HttpMiddleware.cors`. Host origin restrictions cover the configured RPC path and `/api/auth/*`, including `/api/auth`; other foreign origins still receive 403 there.
- Identity exports `sweepExpiredSessions`, an Effect over the application's SQL client that deletes expired Better Auth sessions and returns the number removed without mounting auth.
- The starter worker sweeps expired auth sessions daily at midnight UTC. New apps and apps using the starter updater receive the schedule.
- `authTestDatabase(pool).expireSessions(userId)` expires only the selected user's sessions; omit the user id to expire every session.
- Register schedule definitions beside queues on the admin Jobs page, with null payloads in failed runs, dead-letter listings and job lookups. Pages with no queues can register handlers and serve health.
- Read stored jobs with null payload schemas through the jobs service without changing queue payload validation.
- Show an empty state in the starter Jobs view when no queues or schedules are registered.

### Breaking

- Call `authTestDatabase(pool).expireSessions()` instead of yielding the `expireSessions` property directly.

## 0.20.0 - 2026-10-27

### Added

- Admin pages declare domain permissions shared by RPC middleware and client route metadata. Generated apps declare one role per file, with explicit grants and one permission fallback page.
- Users with `roles.assign` assign a user's single role from the application's declared role set. Role changes cannot remove the final holder of that permission.

### Breaking

- Replace `OpenAdmin` and `AdminPermission` with each page's domain permission: `ReadUsers`/`UsersPermission` or `ReadJobs`/`JobsPermission`. Custom `adminPage` declarations must pass their own `permissionMiddleware` as `permission`; provide its `permissionLayer` at the server host and use `page.route.permission` with React's `permissionGuard` and `PermissionBoundary`.
- Replace the `UsersPage` singleton with `usersPage(AppAccess)` and register `usersHandlers(UsersPage, AppAccess)`. Pass `roles={AppAccess.Role.literals}` to `UsersView`. Server callers pass `AppAccess` first to `listUsers` and `changeUserRole`.
- Replace `ChangeUserRoles` with `AssignRoles` (`roles.assign`), and handle `LastRoleAssigner` instead of `LastOwner`. User results contain `role` instead of `roles`; `changeRole` takes `{ userId, role }` without `grant`. The fixed `UserRole` Schema is removed; use `AppAccess.Role`.
- Existing generated apps must migrate stored comma-separated roles to one declared role string before running the new app. Preserve every final role assigner's access during that data migration. Run the create-app updater to merge the starter's new role files, imports, server permission Layers and client permission boundary; resolve customized wiring conflicts and install dependencies. The updater does not migrate database values. Bootstrap now creates one `owner` role, whose explicit grants include access to all admin pages.

## 0.19.0 - 2026-10-27

### Changed

- Generated apps depend on `@shivaedev/platform` alone for the framework and on `@shivaedev/test-story` and `@shivaedev/quality` for development, import each piece by its own name, and carry `publicHoistPattern: ["@shivaedev/*"]` in `pnpm-workspace.yaml` so the pieces resolve. `create-app update` merges this setup into an existing app: it removes the direct piece entries the app kept from the template and adds the hoist setting.

## 0.18.1 - 2026-10-26

### Changed

- Generated apps use the latest released starter dependencies.

## 0.18.0 - 2026-10-26

### Added

- Add the admin Users page, native RPC handlers and React view for paginated app users and owner-managed roles. Register `UsersPage` with `usersHandlers` beside Jobs and mount `UsersView` using its bound query and role action.
- Add Platform auth user listing and transactional role changes on the existing Better Auth PostgreSQL schema, with typed owner-only and last-owner failures, change invalidation and actor/timestamp logs.
- Mount Users in the starter and generated apps. Existing apps receive the wiring with `pnpm dlx @shivaedev/create-app@latest update` after these packages are released; review template conflicts and install dependencies. Newly bootstrapped administrators also hold the owner role.
- Provide the shared expected failure schemas and `rejectedField` in `@shivaedev/effect-contract/errors/`, so browser-safe contract consumers can use them without depending on Platform. Tags, schema fields and RPC encoding remain the same.

### Fixed

- Generated app development-server stories await Vite process termination and drain its output before the test scope ends, including when dependency optimization is still running.

### Breaking

- Move all imports from `@shivaedev/platform/errors/taxonomy.ts` to `@shivaedev/effect-contract/errors/taxonomy.ts`, and from `@shivaedev/platform/errors/rejectedField.ts` to `@shivaedev/effect-contract/errors/rejectedField.ts`. The old modules are removed. Add a direct `@shivaedev/effect-contract` dependency if the consuming package does not already declare one. Admin, GitHub, Work Board and Work Fleet public failure types now refer to these shared classes.
- Generated apps use the new imports. The create-app updater applies the starter changes through its usual three-way patch; it does not rewrite imports in app-owned files. Replace both old import paths above in those files when upgrading existing apps.

## 0.17.0 - 2026-10-26

### Added

- Generated apps include a development-server story covering admin routes, role enforcement and native jobs data through the existing RPC proxy.

## 0.16.0 - 2026-10-26

### Added

- Generated apps include app-owned admin navigation, Jobs health, counts, failed and dead-lettered lists, job detail, and an example note-statistics page on the existing protected RPC transport. Jobs views accept retry actions from explicitly retry-enabled registrations and retain the default read-only registration.

### Breaking

- `@shivaedev/create-app`'s starter no longer serves the pg-boss dashboard at `/admin/jobs`; the app-owned admin Jobs views replace it. Existing apps must remove `readOnlyDashboard.ts`, `readOnlyDashboardWorker.ts`, `checkDashboardVersion.ts` and `jobDashboard.ts`, remove the `@pg-boss/dashboard` dependency and catalog pin, and register the admin pages and their handlers on the existing `/rpc` host. Keep admin account provisioning through `admin:create`, `admin.ts` and `createAdmin.ts`.
- `@shivaedev/quality`'s `appViteConfig` leaves `/admin/jobs` on the client router. Apps that still host a server dashboard at that path must add their own Vite `server.proxy` entry for `/admin/jobs` targeting the app host.

## 0.15.7 - 2026-10-25

### Changed

- Generated apps use the latest released starter dependencies.

## 0.15.6 - 2026-10-25

### Changed

- Generated apps use the latest released starter dependencies.

## 0.15.5 - 2026-10-25

### Changed

- Generated apps use the latest released starter dependencies.

## 0.15.4 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.15.3 - 2026-10-25

### Changed

- Each mounted host owns its in-memory rate-limit buckets and releases them with its scope.
- Starter stories import the application host without resetting modules.
- Application test configuration no longer inlines Better Auth for module resets.

## 0.15.2 - 2026-10-25

### Changed

- Generated apps use the latest released starter dependencies.

## 0.15.1 - 2026-10-25

### Changed

- `tests/named-values` now accepts zero and status or exit codes.
- Generated apps' stories assert observed items instead of numeric aliases.

## 0.15.0 - 2026-10-25

### Added

- effect-sql records the database release after successful migrations and coordinates worker drain with typed PostgreSQL heartbeat rows.
- effect-pg-boss pauses fetching while the database belongs to another release, finishes active jobs, and resumes when its release owns the database again.
- Platform migration options accept an optional `release` for deployment migration and worker readiness.
- Generated workers step aside for a newer release and drain on SIGTERM, with queue expiry, stop timeout and Railway draining configured together.

## 0.14.1 - 2026-10-25

### Added

- `queryRoute` supplies TanStack Router query loaders and search dependencies, mapping `NotFound` rejections to the route's not-found component.
- `@shivaedev/platform`: `authDatabase` accepts optional `max` and `application_name` pool settings.

### Changed

- Generated starter notes routes use query loaders and show a not-found screen for missing notes, with a link back to the list.
- `@shivaedev/create-app`: Starter stories run the web host and worker with test-sized SQL, authentication and jobs pools.

## 0.14.0 - 2026-10-25

### Added

- `@shivaedev/effect-sql` exports `pendingPostgresMigrations` to read pending ledger migration IDs and names and schema component names and details.
- `@shivaedev/platform` logs migration wait start, periodic progress, completion and timeout through Effect's logger with pending migration and component annotations. `migrations.progressInterval` controls progress logging independently of polling and defaults to 30 seconds.
- Generate the starter foundation without the notes example with `create-app <folder> --minimal`; starter updates preserve the minimal choice.
- Generated apps record and lower Quality debt with `pnpm baseline write --rule <id>`, `pnpm baseline tighten` and `pnpm baseline prune`, with guidance on when to use each command.

### Changed

- `@shivaedev/create-app`'s starter worker uses the host's migration wait logs and keeps its job readiness line.

## 0.13.5 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.13.4 - 2026-10-25

### Changed

- Generated apps use the latest released starter dependencies.

## 0.13.3 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.13.2 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.13.1 - 2026-10-25

### Changed

- Generated apps use the latest released starter dependencies.

## 0.13.0 - 2026-10-25

### Added

- Generated apps record their generator version and can run `create-app update` in a clean Git repository to merge later starter changes, preserve app edits and deletions, and leave listed conflicts for manual resolution without committing.
- Migration options accept schema components beside the numbered loader. Components apply after the ledger commits and report pending work through the same readiness check and host wait loop.
- `pgBossSchema` registers pg-boss installation and upgrades as a schema component, reporting the schema's installed and required versions.
- Quality provides a React application TypeScript preset, shared Vite and Vitest configuration helpers, application hook setup, and the shared application CI command.
- Platform provides configured local database preparation and a development runner for the server, worker and Vite processes.

### Changed

- Generated apps migrate pg-boss through their migration list and start producers and workers with schema migration disabled.
- Generated apps reference their packages’ foundation configuration and helpers so dependency updates carry shared fixes into existing apps.

### Fixed

- Migration-step controllers capture schema-component services when constructed, keeping subsequent migration calls free of external service requirements.

## 0.12.0 - 2026-10-24

### Added

- Contracts expose `application`, a native RPC group for building application handlers without naming the reserved `$changes` stream. Middleware stays attached, and Platform hosts complete the full contract with the stream handler.
- Generated applications build their handlers through the contract's `application` group.
- Quality recognizes client, server and numbered migration folders inside application modules, preserving their runtime boundaries.

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.
- New apps get the notes example as one removable module and fresh migrations. Apps already generated are unaffected.
- Generate apps with Railway 3.16.0.

### Fixed

- Generated apps install the queue schema before publishing application migrations, so workers started before deployment wait for all required schema work.

## 0.11.24 - 2026-10-24

### Changed

- Align published dependency and peer pins and the generated starter with React and React DOM 19.3.1, TanStack Router 1.170.45, Better Auth 1.7.10, happy-dom 21.0.3 and Vitest 5.0.5. The starter also uses pg-boss dashboard 1.12.1.

### Fixed

- Run the generated app's production web and worker entry points in deployment stories, waiting for the database-backed health check and the worker's existing readiness log.

## 0.11.23 - 2026-10-22

### Fixed

- Generated apps use the same third-party catalog versions as the repository's tested starter.

## 0.11.22 - 2026-10-22

### Fixed

- Generate a standalone catalog aligned with the published framework peers for React, router, Vitest and happy-dom. The generated CI command checks peer dependencies before application checks so incompatible pins fail the published-starter gate.
- Load only the selected web or worker application in the generated deployment-story launcher, matching the production process boundary and avoiding unnecessary web startup work in worker stories.

## 0.11.21 - 2026-10-21

### Fixed

- Generated applications start without Quality baseline debt or a migration lint exception, and migration `0006_auth_admin` creates the admin plugin's auth fields through Better Auth with options pinned in the migration.

## 0.11.20 - 2026-10-21

### Fixed

- Generate apps with the pnpm version used to validate the starter, so setup installs the Quality gate and reaches the initial commit without first provisioning an older pnpm binary.

## 0.11.19 - 2026-10-21

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.18 - 2026-10-21

### Changed

- Require pg-boss 12.38.0 and generate applications with the matching @pg-boss/dashboard 1.12.0.

### Fixed

- Support schema 46 in the PostgreSQL expiry test controls, preserving native supervision and dead lettering.

## 0.11.17 - 2026-10-20

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.16 - 2026-10-19

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.15 - 2026-10-19

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.14 - 2026-10-19

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.13 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.11.12 - 2026-10-19

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.11 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.11.10 - 2026-10-19

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.9 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.11.8 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.11.7 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.11.6 - 2026-10-19

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.5 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.11.4 - 2026-10-19

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.3 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.11.2 - 2026-10-19

### Changed

- Generated apps use the latest released starter dependencies.

## 0.11.1 - 2026-10-19

### Changed

- Generated apps use stock shadcn Base UI components instead of Radix. In apps generated earlier, re-add badge, button, tabs and tooltip from the Base UI registry and replace `asChild` composition with the `render` prop (for example, `<Button render={<a href="/notes" />}>Notes</Button>`). Use `TooltipProvider`'s `delay` prop instead of `delayDuration`.

## 0.11.0 - 2026-10-18

### Added

- Generated notes apps use repository announcements, host subscriptions and session-owned live queries without application invalidation calls, channel configuration, subscription handlers or `live()` wiring.

## 0.10.2 - 2026-10-18

### Changed

- Generated apps use the latest released starter dependencies.

## 0.10.1 - 2026-10-18

### Changed

- Generated apps use the latest released starter dependencies.

## 0.10.0 - 2026-10-18

### Added

- Generated apps use Platform's shared Better Auth mount and scoped auth database pool instead of carrying their own server implementations. Provider options and RPC session policy stay in the application.
- effect-sql exports `MIGRATIONS_DIRECTORY` and `MIGRATION_FILE_PATTERN` from `migrationConvention.ts`, and `migrationsFromDirectory(root)` to discover the app's sequentially numbered migration files with Effect's filesystem loader.
- create-app ships the starter's discovered `src/server/migrations/` folder and validates its zero-padded sequential filenames when packing the template.
- effect-sql exports `clientOptions(options, { snakeCase? })` and `SqlNameTransforms` from `clientOptions.ts`. New clients configured with this helper use Effect SQL's native camelCase-to-snake_case query names and snake_case-to-camelCase results by default. Pass `{ snakeCase: false }` to preserve native names, or supply native transform functions in the options.
- Platform's app database and app host configuration accept native `transformQueryNames` and `transformResultNames`, so applications can use effect-sql's client options without replacing the host's database layer.

### Changed

- Newly generated applications configure snake_case SQL columns through effect-sql. The starter migrates existing note ownership and word-count columns while retaining camelCase model fields.

## 0.9.0 - 2026-10-18

### Added

- Generated apps include light and dark shadcn tokens that meet WCAG AA for text and focus, follow the system color scheme, and offer a saved System, Light or Dark theme choice. A contrast story checks the stylesheet's text and focus pairs.
- Generated apps include a PostgreSQL story that applies every numbered migration and checks Better Auth's configured plugins need no additional columns or tables.

## 0.8.0 - 2026-10-18

### Added

- Generated apps serve the official pg-boss dashboard at `/admin/jobs`, with admin-only access on pages, data and assets, enforced read-only operation, and the app's existing database configuration. The generated README explains creating an admin and inspecting jobs. Startup checks that the dashboard's bundled pg-boss matches the app's installed version.
- Generated apps include a stock shadcn Base UI Switch and a `LabelledSwitch` pattern that keeps its setting label as its accessible name while displaying On/Off separately.

### Changed

- Generated apps read local database setup configuration inside Effect, use the database names in `DATABASE_URL` and `TEST_DATABASE_URL`, and fail with a typed configuration error when either URL is missing.
- New apps build their sortable notes table on TanStack Table 9: `DataTable` registers row sorting through `tableFeatures`, renders with `FlexRender` and exports `DataTableFeatures` for typed column helpers.
- Generated apps typecheck with TypeScript 7 instead of TypeScript 6, while Quality keeps its own compiler API dependency.

## 0.7.0 - 2026-10-18

### Added

- Generated apps enable Better Auth's admin plugin, migrate its schema on new and existing databases, and provide `pnpm admin:create` to create the first administrator through Better Auth's server API.

### Fixed

- A generated app pins the current published framework versions, including `platform` 0.16.0, `effect-form` 0.5.0, `effect-react` 0.5.0, `effect-service` 0.4.0, `effect-test` 0.6.0, `effect-trpc` 0.8.0, `effect-prisma` 0.10.0, `local-postgres` 0.4.0, `quality` 0.25.0 and `test-story` 0.7.1.

## 0.6.11 - 2026-10-18

### Changed

- New apps include stock shadcn components, a sortable notes data table, Recharts chart primitives, a code preview for added, removed and context lines, and a `quality.config.ts` that preserves CLI-owned components while checking application code.
- Generated applications point to the shared `story-testing` skill for writing and reviewing stories and their test kits.

## 0.6.10 - 2026-10-18

### Fixed

- Align published framework dependencies with the current releases.

## 0.6.9 - 2026-10-18

### Fixed

- Generated apps log terminated idle Better Auth database connections at debug and continue serving queries on a fresh connection.
- Keep nested README.md, AGENTS.md, CLAUDE.md and published-versions.json files in generated apps while excluding the starter's root maintenance files.

## 0.6.8 - 2026-10-17

### Fixed

- Generated app READMEs describe the variables each process needs and web's ownership of Railway pre-deploy migrations.
- Creating an app without a configured Git identity no longer stalls for seconds while Git guesses an email from the host name. The initial commit uses the Create App identity unless Git's `user.name` and `user.email` settings or the `GIT_AUTHOR_*` variables provide one; `EMAIL` and host-name guesses no longer count.
- Keep saved notes and the empty-list message visible without an initial loading message while the generated app refreshes its notes list.
- A generated app pins the current published framework versions, including `platform` 0.14.2, `effect-prisma` 0.9.2, `effect-test-sql` 0.5.2, `local-postgres` 0.3.0 and `quality` 0.23.0.

## 0.6.7 - 2026-10-17

### Fixed

- A generated app gets its own named README and framework guidance, with `CLAUDE.md` linked to `AGENTS.md`, without template maintenance files or names.
- A generated app uses matching development and test database names in both environment files, reads only `TEST_DATABASE_URL` for tests, and includes only existing TypeScript paths.
- A generated app keeps non-secret files and its installed lockfile at mode `0644`, with `.env.local` at `0600`, and pins the current published framework versions.
- A generated app logs a warning when PostgreSQL terminates an idle Better Auth connection, instead of crashing the process with an uncaught pool error.

## 0.6.6 - 2026-10-17

### Changed

- New apps start on `@shivaedev/effect-test-sql` 0.5.1, whose migration steps accept zero-padded migration names as written.

## 0.6.5 - 2026-10-17

### Changed

- New apps start on `@shivaedev/effect-pg-boss` 0.8.0, which bounds each batched job by its own expiry deadline.

## 0.6.4 - 2026-10-17

### Changed

- Generated apps use effect-test-sql 0.5.0, whose `migrationSteps` lets tests seed rows between migrations to check backfills.

## 0.6.3 - 2026-10-17

### Fixed

- Generated apps use effect-pg-boss 0.7.1 so one failing job no longer fails or retries the other jobs in its batch.

## 0.6.2 - 2026-10-17

### Changed

- Generated apps use effect-pg-boss 0.7.0: workers drain backlogs in batches without waiting for the polling backstop, and job handlers queue follow-up jobs through their worker's own client.

## 0.6.1 - 2026-10-17

### Fixed

- Construct Better Auth through the shared host's deferred application Effect after database readiness, with schema validation explicitly enabled to report real auth-column drift.
- Generated apps use Platform 0.14.1 to redact URL query values, fragments and userinfo in exported traces. Platform 0.13.0 and 0.14.0 exported URL query values; apps with tracing enabled should upgrade.

## 0.6.0 - 2026-10-17

### Changed

- Generated apps control Better Auth rate limiting through Effect Config `AUTH_RATE_LIMIT_ENABLED`, enabled by default in every environment. Client-IP and rate-limit stories use the ordinary in-process host, including coverage with the switch disabled.

### Fixed

- A generated app’s worker and `pnpm migrate` command need only `DATABASE_URL`; shared migrations derive Better Auth’s schema without constructing an auth instance.
- A generated app runs migrations in web’s Railway pre-deploy step. Web and worker check the schema at startup without migrating; an outdated schema prevents authentication, HTTP and jobs from starting. The migrate command is idempotent.
- A generated app’s worker logs its applied-migrations check and readiness to take jobs through Effect’s logger.
- A generated app’s Railway TypeScript configuration runs migrations only in web’s pre-deploy container and gives the worker only `DATABASE_URL`; web’s healthcheck uses the database-backed `/health` route.
- Generate an app with aligned framework versions, including `effect-sql` 0.5.0 and its matching SQL test package, so framework dependencies do not install conflicting versions.
- A generated app registers producer queues and their dead-letter queues through `effect-pg-boss` queue definitions. Note writes enqueue independently after their transaction and log queue failures without failing the saved write; the starter no longer supplies a transactional database adapter.
- Generated apps can select the auth client IP header with `AUTH_CLIENT_IP_HEADER`, still gated by `TRUSTED_PROXY`. Railway uses `x-real-ip` so different visitor IPs have separate auth rate-limit buckets and the same visitor IP shares a bucket across changing `X-Forwarded-For` values. Other deployments keep the `x-forwarded-for` default.

## 0.5.0 - 2026-10-17

### Added

- Generated apps include a DOM story that signs up, signs out, signs in and reads Better Auth cookie sessions against the real PostgreSQL host, using `@shivaedev/test-story`.
- Generated apps use Platform 0.13.0 and export Effect spans from the host and word-count worker when standard OTLP endpoint variables are set.

## 0.4.2 - 2026-10-16

### Fixed

- A generated app excludes `@shivaedev/*` from pnpm's release-age wait so framework releases can install immediately, while third-party packages keep pnpm's default wait.

## 0.4.1 - 2026-10-16

### Fixed

- Generated apps use `TRUSTED_PROXY` for Better Auth client IP rate limiting and the host's forwarded authority. Auth ignores forwarded IP headers from untrusted peers, and trusted visitors have separate sign-in buckets, including with mapped IPv6 CIDRs such as `::ffff:127.0.0.0/104` and appended forwarding chains.

## 0.4.0 - 2026-10-16

### Added

- Initialize a generated app's Git repository with one commit after installation when Git is available and no repository encloses the destination; `--no-git` skips initialization.
- Include a GitHub Actions workflow that runs the generated app's lint, typecheck, build and PostgreSQL tests through its `ci` script.
- Include Railway TypeScript infrastructure configuration for PostgreSQL, web and worker services, deployment migrations and an HTTP health check, with a CLI deployment walkthrough in the quickstart.
- Run setup after Git initialization to install dependencies and Quality's pre-commit hook before the initial commit; failed lint or typecheck gates block that commit.
- Include `setup` for dependencies and checkout hooks, and `ready` for the same lint, typecheck, build and test gate as CI.

## 0.3.0 - 2026-10-16

### Added

- Generated apps include a story kit for authenticated HTTP and PostgreSQL tests, plus screen and migration stories, with guidance to extend the kit for new features.

## 0.2.2 - 2026-10-16

### Changed

- Generated apps use Platform 0.9.0 and read signed-in user profiles through `SessionUser`, including a `notes.whoami` query without auth-table SQL.

## 0.2.1 - 2026-10-14

### Changed

- New applications start on Platform 0.8.0 and Better Auth 1.7.7.

### Fixed

- New applications pin happy-dom 20.14.6, which fixes a cookie scope forgery vulnerability. The template still pinned 20.11.2.

## 0.2.0 - 2026-10-13

### Changed

- New applications start on Effect 4.0.4 and Vitest 5.0.3.

## 0.1.3 - 2026-10-13

### Added

- Generated apps can open, edit and delete notes. Versioned writes reject stale edits and deletes, while the editor retains drafts through live refreshes and conflicts.
- Upgrade existing starter notes with a numbered version-column migration and use the notes repository for the word-count worker.

### Fixed

- Generated apps keep database setup in the server runtime so it passes the pinned Quality runtime checks.

## 0.1.2 - 2026-10-13

### Added

- Generate a git-ignored `.env.local` with a fresh authentication secret and app-specific development and test database URLs without overwriting existing files.
- Generated apps prepare both local PostgreSQL databases with `pnpm db:setup` before `pnpm dev`, and load `.env.local` when running `pnpm test`.

### Fixed

- Generated development server and worker processes use installed JavaScript package exports instead of workspace source conditions.

## 0.1.1 - 2026-10-13

### Added

- Generated applications include a PostgreSQL migration upgrade check for their notes model, using `@shivaedev/effect-test-sql@0.2.0`.

## 0.1.0 - 2026-10-13

### Added

- Create and install the maintained starter with `pnpm create @shivaedev/app <folder>`, using exact published Platform versions, refusing nonempty folders, and printing environment and development steps.
