# Changelog

## 0.2.3 - 2026-10-16

### Fixed

- A generated app’s worker and `pnpm migrate` command need only `DATABASE_URL`; shared migrations derive Better Auth’s schema without constructing an auth instance.
- A generated app runs migrations in web’s Railway pre-deploy step. Web and worker check the schema at startup without migrating; an outdated schema prevents authentication, HTTP and jobs from starting. The migrate command is idempotent.
- A generated app’s worker logs its applied-migrations check and readiness to take jobs through Effect’s logger.
- A generated app includes separate Railway web and worker configurations; the web healthcheck uses the database-backed `/health` route.

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
