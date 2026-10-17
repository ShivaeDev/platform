# Roadmap

## Built

- A folder argument creates and installs the starter with exact published Platform versions.
- Packing snapshots `examples/starter` without local dependencies, build output, lockfiles or environment secrets.
- Existing nonempty folders are refused before any write or install.
- Each generated app has a git-ignored local environment with a fresh authentication secret and app-specific development and test database URLs.
- A generated app has its own named README, framework guidance and linked `CLAUDE.md`, matching example database URLs, and normal non-secret file permissions without template maintenance files or names.
- The generated app prepares both local databases before development and loads its test database URL from the local environment.
- The published-starter check runs the packed command's output through typecheck, build and PostgreSQL/authenticated HTTP tests.
- A generated app gets an initial Git commit outside an enclosing repository when Git is available; `--no-git` opts out.
- Setup installs dependencies and Quality's hook after repository initialization; the initial commit runs lint and typecheck, and `pnpm ready` runs the full local gate.
- A generated app includes GitHub Actions checks against PostgreSQL and Railway build, migration, start and health-check configuration.

## Open questions

No open generator decisions.
