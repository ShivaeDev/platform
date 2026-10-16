# Roadmap

## Built

- A folder argument creates and installs the starter with exact published Platform versions.
- Packing snapshots `examples/starter` without local dependencies, build output, lockfiles or environment secrets.
- Existing nonempty folders are refused before any write or install.
- Each generated app has a git-ignored local environment with a fresh authentication secret and app-specific development and test database URLs.
- The generated app prepares both local databases before development and loads its test database URL from the local environment.
- The published-starter check runs the packed command's output through typecheck, build and PostgreSQL/authenticated HTTP tests.
- A generated app gets an initial Git commit outside an enclosing repository when Git is available; `--no-git` opts out.
- A generated app includes GitHub Actions checks against PostgreSQL and Railway build, migration, start and health-check configuration.

## Open questions

No open generator decisions.
