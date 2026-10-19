# Changelog

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
