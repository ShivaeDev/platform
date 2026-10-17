# Changelog

## 0.4.2 - 2026-10-17

### Fixed

- A generated app registers producer queues and their dead-letter queues through `effect-pg-boss` queue definitions. Note writes enqueue independently after their transaction and log queue failures without failing the saved write; the starter no longer supplies a transactional database adapter.

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
