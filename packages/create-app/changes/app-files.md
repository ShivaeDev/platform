### Fixed

- A generated app gets its own named README and framework guidance, with `CLAUDE.md` linked to `AGENTS.md`, without template maintenance files or names.
- A generated app uses matching development and test database names in both environment files, reads only `TEST_DATABASE_URL` for tests, and includes only existing TypeScript paths.
- A generated app keeps non-secret files and its installed lockfile at mode `0644`, with `.env.local` at `0600`, and pins the current published framework versions.
