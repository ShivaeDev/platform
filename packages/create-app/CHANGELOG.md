# Changelog

## 0.37.0 - 2026-11-02

### Added

- Generated apps select and sync the story-testing skill from `@shivaedev/skills`, link their agent guide to the local copy and check managed skills during lint.

### Fixed

- Preserve `shivaedevSkills` when preparing full and minimal app manifests.
- Leave starter deletions of customized app files as Git modify/delete conflicts, preserving app contents and applying the rest of the starter delta. Record the applied generator version and explain how to keep or delete each conflicted file.
- Generated apps apply the host's replacement Layer to module ports before binding services, including the notes source, rate-limit store and job queue.
- Note creation, import and edits commit with their word-count enqueue. An enqueue failure rejects the request and rolls back the note write.

## 0.36.0 - 2026-11-02

### Added

- Add `redactBrowserText` to mask quoted browser literals, including escaped quotes and multiline content, while preserving diagnostic shape and the existing server text policy.
- Add opt-in `browserErrors` settings for an Error log per report, signed-in `user.id` attribution and session enforcement. The starter enables all three.

### Fixed

- Mask browser report messages and stacks before they reach diagnostic sinks and record reports at Error severity.
- Apply starter updates to apps inside enclosing Git repositories while preserving sibling files and unrelated staged changes. Keep the generation record unchanged when a nonempty starter delta applies no changes.
- Generated notes apps show an alert when adding or saving a note defects, keep the draft, and handle delete completion in the note's own action.
- Generated Railway workers receive shared `RESEND_API_KEY`, `EMAIL_FROM` and `PUBLIC_URL` settings. Production workers require an explicit email sender at startup; deployment instructions describe queued auth email delivery and the worker's production settings.
- Generated starter stories settle through screen pending signals and completed HTTP/live results instead of status markup or timed connection sampling. Remove the redundant third-party session lifecycle fixture and its teardown delays.

## 0.35.0 - 2026-11-01

### Added

- Enforce `imports/admin-paths`: report admin-only source files outside an `admin/` path and admin files reached by member code, naming the destination folder. Follow production imports within each source tree while allowing registration composition and shared member dependencies.
- Admit per-key budgets through `@shivaedev/rate-limit`, with an Effect-clock memory store, a PostgreSQL adapter, and typed `TooManyRequests` carrying a retry time.
- Include rate limiting in Platform and demonstrate a per-user note creation budget in generated applications.
- Send transactional email through a Resend-backed Mailer or development log, with typed message queues, job-id idempotency, backoff and provider-timed rate-limit retries.
- Read delivered messages and one-time links through a fake Resend inbox in stories.
- Include the email package in Platform for applications, including the starter's queued authentication emails.

### Fixed

- Report production imports of the `@effect/platform-node` barrel with module subpaths that avoid loading optional integrations such as redis.
- Recognize native Effect `catchTags` record keys regardless of the handler body while retaining diagnostics for actual nested component and hook factories.
- Keep a constant's matching filename valid when the constant becomes private.
- Name each conflicting fix and format pass's file and line/column range when `quality fix` cannot settle.
- Use Node platform module subpaths in package runtimes and commands instead of loading the barrel.

### Breaking

- Generated apps keep shared declarations outside the admin-only tree. Migrate custom `ReadStatistics` imports from `#admin/ReadStatistics.ts` to `#ReadStatistics.ts`, and custom `AdminNavigation` type imports from `#client/admin/Shell.tsx` to `#client/AdminNavigation.ts`.

## 0.34.0 - 2026-11-01

### Added

- Wire Better Auth's four email callbacks through one `emails` mount option. Deliver typed account confirmation, email-change approval, new-address confirmation, password-reset and existing-account messages with application route links and decoded new addresses.
- Throttle email delivery attempts per account and message kind within a configurable, mount-local window that defaults to one minute.
- Generated starters wire typed, throttled auth emails and provide application confirmation and password-reset routes.

## 0.33.0 - 2026-11-01

### Added

- Export Effect logs as trace events and ErrorReporter reports as error spans through the redacting Railway OTLP pipeline in appHost and worker Layers.
- Mount a same-origin browser error reporting route in appHost, with server redaction, bounded reports and per-client rate limiting.
- Generated starters enable Railway manual tracing for web and worker services and mount browser reporting by default.
- Add useBrowserErrors to forward uncaught browser errors and unhandled rejections to the host, removing listeners on unmount.
- Rules can validate inventory-dependent configuration through `defineRule`'s `validate` callback before checking files.
- Identity exposes `signInAgain(auth, userId)` to mint a fresh test session for an existing user using the caller's Effect Clock and Better Auth's configured lifetime.
- Generated apps provide session renewal verbs for HTTP visitors and browser cookies after long story clock jumps.

### Changed

- Generated starters declare auth ownership with reasoned globs for Quality.
- The starter's app and cookie story kits start TestClock at the present by default so Better Auth's wall-clock endpoints accept minted sessions. Stories can still choose an explicit clock.

### Fixed

- Mask complete RPC payload annotations before exporting logs and error reports, keeping sensitive error values out of Railway diagnostics even when the request uses public field names.
- Enable Biome's `noDelete` as an error while disabling its automatic fix so diagnostics remain visible without rewriting deletion behavior.

### Breaking

- Glob options (`toolOwned`, `content`, `edge`, `owners` and `suites`) require `{ glob, reason }` declarations. Replace each string with a declaration explaining its purpose, and remove patterns that match no current inventoried file. Stale declarations fail configuration.
- Lint and baseline commands refuse legacy exception registries. Run `quality exceptions migrate` (or `quality exceptions migrate --from <registry>`) to move entries into config exceptions.

## 0.32.1 - 2026-10-31

### Changed

- Generate admin-only declarations, reads, registrations, views and story support under `admin/` paths, keeping note statistics inside the notes module. The bootstrap command remains `pnpm admin:create`.

## 0.32.0 - 2026-10-31

### Added

- Admin pages can declare a detail path under `route.detail`. `adminDocuments` and `adminPermissionGuard` use the registered page's permission for its list and detail paths.
- Identity permission layers accept native context keys for permission middleware.
- Generate frozen PostgreSQL auth migration modules containing checked-in SQL with no Better Auth runtime dependency. Check migrated databases against current auth options and report missing tables, fields, indexes, types and nullability changes.
- Generated applications ship frozen auth migrations, retain their Quality configuration, and include a PostgreSQL story that checks their current auth options for drift.
- Identity mounts accept a configured `accountRoleSeed` to grant a role to named provider accounts at boot and sign-in through the guarded `assignRole` path. The shared `ProviderAccounts` schema accepts empty lists for seeds while `AllowedAccounts` continues to require at least one account.

### Changed

- Generated applications declare their owner seed from `AUTH_OWNER_ACCOUNTS`, with empty and unset lists granting nothing.

### Fixed

- Generated apps use admin registration for permission layers and guard each admin document by its registered page.
- Execute live auth migration DDL through the native SQL transaction connection, so a preceding migration referencing users cannot block a later auth alteration through another pool.
- Trusted `assignRole` commands work without an application Reactivity Layer and preserve an existing service for commit invalidation.
- Generated apps mount with the system theme when browser storage is blocked. Theme choices still apply when storage cannot save them.

### Breaking

- Admin registrations install their pages' permission middleware and require `AdminSessions` when their handler layer builds. Provide `Layer.succeed(AdminSessions, sessions)` once at the host instead of installing each page's `permissionLayer` by hand. Missing policy fails startup with the page id and permission name.
- Declare page middleware with identity’s `permissionMiddleware` so it provides `Identity` and `SessionUser` with the shared identity failures.
- Generated apps import `ReadStatistics` from `#ReadStatistics.ts` and `StatisticsPermission` from `#modules/notes/StatisticsPermission.ts`; migrate custom imports of `#appPermissions.ts` when applying the template update.

## 0.31.0 - 2026-10-31

### Added

- `migrateBetterAuth` runs Better Auth schema migrations using the database from Effect's SQL service. Applications pass auth configuration without a database pool.
- Generated applications mount roles through identity, migrate the stored default through a numbered migration, and bootstrap the first owner through `assignRole`.
- Declare the user role field and its sign-up default through identity, and adopt existing users with `migrateBetterAuth(options, { defaultRole })` without an application backfill. Fresh and upgraded PostgreSQL schemas have the same non-null text column and database default.
- Let identity's database story kit migrate schemas with or without roles, inspect the stored role column and user roles, and model a missing role.

### Fixed

- Generated applications start with no quality baseline and rely on the jobs package’s peer installation of `pg-boss`.
- Loaded editors construct their form from the supplied row without an unreachable synchronous guard.
- Refuse missing stored roles with `Forbidden` and log the migration fix instead of failing requests with a defect.

### Breaking

- `registerAdmin` reports missing or extra page handlers as defects when its handler Layer is built. Consumers that catch synchronous registration errors must instead observe Layer acquisition failures.
- Pass `defaultRole` alongside `roles` to `betterAuthMount`. Remove application-owned role `additionalFields` and Better Auth's `admin()` plugin if it was only supplying roles. Add and run a numbered `migrateBetterAuth(options, { defaultRole })` migration before deploying, then bootstrap administrators through `assignRole`.

## 0.30.0 - 2026-10-31

### Added

- `quality baseline write --first-adoption --rule <id>` records existing debt when a shared rule that refuses config exceptions gains new checks. It may include unchanged files; ordinary baseline writes still require changed `--file` selections. Review the resulting counts and state why retained debt needs a separate migration.

### Fixed

- Minimal generated apps carry the same existing foundation-registration boundary debt as the full template, so their first commit passes the stricter Quality gate after baseline pruning.
- Record the applied starter version even when its merge leaves conflicts. List conflict-marker files and unresolved Git conflicts, run install and the app's typecheck, and exit nonzero with the remaining work instead of claiming success. Include dependency re-resolution guidance when pnpm rejects a trust downgrade.

### Breaking

- `effect/boundary` reports synchronous Node filesystem and child-process calls, core `Effect.run*` runners, Promise parameters and callbacks, throwing APIs inside `Effect.sync`, and each call to a helper that throws. Move IO to Effect services, yield computations in the current runtime, and use `Effect.try` with tagged failures for throwing work. Outside-library bridges belong in `adapters/`. Record retained first-adoption debt with `quality baseline write --rule effect/boundary --first-adoption`, then lower it with `quality baseline tighten` as repairs land. Runners remain accepted at entry points, in tool configs and in tests.
- Consumers calling `runtimeOf` or `runtimeDeclarationProblems` from `@shivaedev/quality/imports/runtime.ts` must provide Effect's `FileSystem.FileSystem` service, for example with `NodeFileSystem.layer`. Directory probes now use that service and report filesystem failures as `FilesystemFailure`; only missing directories are treated as absent.
- Consumers constructing `Command` records from `@shivaedev/quality/cli/args.ts` with `_tag: "BaselineWrite"` must set `firstAdoption: false` for ordinary scoped writes, or `true` for an explicit shared-policy upgrade.

## 0.29.0 - 2026-10-31

### Added

- `JobsView` from `@shivaedev/admin/client/JobsView.ts` renders failed and dead-lettered jobs, readable failure summaries, health, counts, pagination and detail using the application's bound Jobs client and shared queue names. An optional native retry action enables retry for failed originals; the Jobs page's grants remain enforced by its host.
- Provide `SessionsPage` and `SessionsView` using identity's session administration calls and permission, with session timestamps, an own-session marker and inline revoke confirmation. Applications supply the current session id and sign-out callback.
- Generated starters mount the Sessions admin page and sign out after revoking the current session.
- `SessionBoundary` accepts `redirectTo` and an optional `navigate` callback to continue sign-in through a same-origin URL replacement after unmounting the signed-out tree and before mounting the signed-in tree. Unsafe targets fall back to `/`.
- React's `permissionGuard` accepts `staticData.signedIn: true` for routes that require a session without a permission grant. Signed-out viewers use the existing sign-in redirect and return location; undeclared routes remain public and matched permission requirements still apply.

### Changed

- Generated starters use the shared admin Jobs view and include its styles from both standalone and workspace installs.
- Server and the platform dependency shell no longer declare `pg` as an optional peer; its PostgreSQL integration uses the native pool from sql.
- Generated starters import schedule definitions and the default queue client factory from their defining modules.
- Generated apps declare the notes routes as signed-in-only and install `permissionGuard` once at the root, redirecting signed-out viewers before loading notes.

### Fixed

- Report ambient runtime workarounds in core code: runners over Clock, Config and Random, unsafe clock reads, cryptographic randomness, performance time, process state and scheduling. Entry points, tool configs, adapters and test-support retain their boundary role for these checks.
- Generated apps prune their copied baseline after formatting and before the initial commit, so repaired debt cannot block the strict commit gate.
- Generated app guidance shows file-scoped baseline writes and stages new files before recording their debt.
- Failing reports point moved files to baseline pruning instead of suggesting repo-wide debt recording.
- Report exported type aliases of imports, value aliases with `typeof` annotations or local const chains, object facades and unchanged forwarding functions, with repairs naming their defining modules. Keep wrappers that transform inputs, add steps, supply defaults or declare overloads.
- Generated apps let the boundary hand off sign-in navigation and identify cookie sessions by user id, preserving signed-in screen state when a session rotates after a password change.
- Generated applications finish Better Auth's startup schema validation before using authentication or releasing its database scope.

### Breaking

- Repositories upgrading Quality must repair the newly reported ambient access or record existing adoption debt with `quality baseline write --rule biome/plugin`, then lower it as repairs land.
- `createApp` reads secret bytes from Effect's Crypto service. Applications embedding this Effect must provide `Crypto.Crypto`, for example with `NodeServices.layer` or `NodeCrypto.layer` from `@effect/platform-node`. The create-app command already provides it.
- The pg-boss testing-expiration bridge moved from `@shivaedev/jobs/server/internal/testingExpirations.ts` to `@shivaedev/jobs/server/adapters/testingExpirations.ts`. Consumers importing that internal path must import the adapter path instead.
- Replace `authDatabase(url, { max, application_name })` from identity's `server/better-auth/mount.ts` with `yield* betterAuthDatabase()` from `server/better-auth/adapters/database.ts`, inside the application's SQL environment. Pass the result as Better Auth's `database`. Use sql's `postgresLayer` for standalone processes; database-backed `appHost` exposes the client inside its `application` Effect. Move connection settings to `maxConnections` and `applicationName` on that SQL Layer. Auth now shares its connection budget and lifecycle; remove direct `pg` dependencies when no longer used.
- Replace `authTestDatabase(pool)` with `yield* authTestDatabase` in identity test fixtures, provided with the application's `SqlClient`.
- When applying the generated starter update, replace `poolSizes.auth` with the shared `poolSizes.sql` budget. Auth migrations use the application SQL environment; remove custom `AuthMigrationDatabase` providers.
- Recording an existing baseline now requires `--rule <id> --file <path>`, and every selected file must be changed since `HEAD`. Replace repo-wide rule writes with explicit changed paths, repeating `--file` as needed; stage new files first. Direct callers pass selected paths as `writeBaseline`'s fourth argument. Initial adoption without a baseline still records existing debt once. For renames, use `quality baseline prune --against <base>` to carry existing counts.
- Pre-commit rejects staged baseline counts that allow more findings than remain in their files. Run `quality baseline tighten --staged` and stage the resulting baseline changes before committing a repair.
- Quality: the gate now rejects imported second names even when they use type aliases, value annotations, object facades or forwarding functions. Import from the defining module and remove the second name; existing facade debt can be recorded at adoption. Import `USAGE` from `cli/messages.ts` instead of `cli/args.ts`.
- Jobs: import `defaultClientFactory` from `@shivaedev/jobs/server/defaultClientFactory.ts` instead of `server/client.ts`. Import `defineSchedule` from `@shivaedev/jobs/server/defineSchedule.ts` instead of `server/definition.ts`. The removed `server/internal/nativeClient.ts` and `server/internal/scheduleDefinition.ts` exports migrate to those same modules as `defaultClientFactory` and `defineSchedule`. The default factory now exposes its native pg-boss return type; type custom factory mocks against `PgBossClient` or `PgBossClientFactory` from `server/client.ts`.
- React: import `resumeSignal`, `ResumeOptions`, `ResumeSource` and `ResumeWindow` from `@shivaedev/contract/resume.ts`; `@shivaedev/react/resumeSignal.ts` is removed.
- Work Board: import `Identity` from `path/Identity.ts`, view state helpers from `browser/views/state.ts`, `isMarkdown` from `path/isMarkdown.ts`, and `processes` from `server/processOwnership.ts`. The forwarding `server/views/state.ts` and `server/integration/processes.ts` modules are removed. Replace the removed `attention` facade with imports of `managedRequestReceipt` from `server/attention/managedRequestReceipt.ts`, `attentionProjection` from `server/attention/projection.ts`, and `RequestReceipt` from `attention/RequestReceipt.ts`. Replace the removed `publication` facade with direct imports from `server/responses/publicationDirectory.ts`. Import `Changes` from `server/files/changes.ts`, `MarkdownFile` from `server/files/list.ts`, `Snapshot` from `server/search/snapshot.ts`, metadata document/model/diagnostic/parsed types from `integration/metadata.ts`, `InboxProjection` from `browser/views/schema.ts` instead of `AttentionProjection`, `SourceFailure` from `diagnostics/source.ts`, and `WorkspaceOptions` from `server/workspace.ts` instead of the integration facades. Metadata types are also removed from `server/metadata/model.ts` and `server/metadata/parse.ts`; import them from `integration/metadata.ts`.
- Work Fleet: import `WAIT_EXIT`, `WaitState`, `WaitOutcome` and `settled` from `host/waitOutcome.ts` instead of `host/wait.ts`; import `fleetRecords` from `fleetRecords.ts` instead of `operations.ts`.

## 0.28.0 - 2026-10-31

### Added

- `@shivaedev/react`: `queryRoute` passes the loader's router context to its query factory alongside params and validated search. Annotate `context` with the parent route's `types.allContext` to read declared clients and viewer state with type checking.

### Changed

- `@shivaedev/create-app`: generated starter routes read clients and session state from native router context instead of taking them as route factory parameters.

### Fixed

- Generated applications provide Node services when running database setup, so setup commands participate in Effect interruption and typed failure handling.

### Breaking

- `@shivaedev/local-postgres`: `assertLocalDatabase`, `sql`, `startPostgres`, `prepareDatabases` and lower-level command helpers return Effects. Yield them in an Effect program and provide `ChildProcessSpawner` for commands, for example with `NodeServices.layer` at a Node entry point. Replace synchronous try/catch with Effect error handling. Command failures use `PostgresCommandError`; local-target and image refusals use `LocalPostgresError`. Construct the Schema tagged errors as `new PostgresVersionMismatch({ expectedVersion: "18.6", observedVersion })` or `new PostgresSettingError({ container: "development-postgres", setting: "max_connections", cause })`. Exhausted readiness checks retain their final failure instead of reporting an unobserved version mismatch.
- `@shivaedev/server`: `setupDatabases()` requires `ChildProcessSpawner` and exposes local PostgreSQL failures in its typed error channel. Provide `NodeServices.layer` at the setup entry point instead of relying on synchronous commands hidden inside the host.

## 0.27.0 - 2026-10-31

### Added

- `makePgBoss(identifier, queueNames)` accepts names from a browser-safe module shared with queue definitions and client filters. Each jobs Layer checks that its queue and schedule registrations match the declaration, and fails boot with `PgBossQueueNamesError` listing missing and unexpected names.
- List active sessions with user details and activity times, and revoke one session through the permission-guarded `identity.sessions` contract. Session revocation uses the existing request and live subscription revalidation path.
- Generated applications grant session management to their admin and owner roles.

### Changed

- Generated applications validate server queue registrations against the shared browser-safe declarations used by the admin Jobs page.

### Breaking

- Jobs Layers include `PgBossQueueNamesError` in their typed startup errors. Consumers with explicit error unions must add this error or handle its tag. Existing services that omit the optional name declaration keep their registration behavior.

## 0.26.4 - 2026-10-30

### Changed

- Generated apps use the latest released starter dependencies.

## 0.26.3 - 2026-10-30

### Changed

- Generated starter apps assign the first owner through identity’s role verb and let identity close Better Auth’s role endpoints.

## 0.26.2 - 2026-10-30

### Changed

- Generated apps use the latest released starter dependencies.

## 0.26.1 - 2026-10-30

### Changed

- Generated apps use the latest released starter dependencies.

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
