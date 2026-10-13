### Added

- Generate a git-ignored `.env.local` with a fresh authentication secret and app-specific development and test database URLs without overwriting existing files.
- Generated apps prepare both local PostgreSQL databases with `pnpm db:setup` before `pnpm dev`, and load `.env.local` when running `pnpm test`.

### Fixed

- Generated development server and worker processes use installed JavaScript package exports instead of workspace source conditions.
