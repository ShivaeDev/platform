# Roadmap

## Built

- A folder argument creates and installs the starter with exact published Platform versions.
- Packing snapshots `examples/starter` without local dependencies, build output, lockfiles or environment secrets.
- A generated app has its own README and linked agent guidance, app-specific names and database examples, and normal non-secret file permissions.
- A release check rejects stale framework pins against npm and releases in the same commit.
- Existing nonempty folders are refused before any write or install.
- Each generated app has a git-ignored local environment with a fresh authentication secret and app-specific development and test database URLs.
- The generated app prepares both local databases before development and loads its test database URL from the local environment.
- The published-starter check runs the packed command's output through typecheck, build and PostgreSQL/authenticated HTTP tests.

## Open questions

No additional generator options are selected.
