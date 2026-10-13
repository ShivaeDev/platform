# Changelog

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
