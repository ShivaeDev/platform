---
"@shivaedev/quality": patch
---

### Fixed

- Install a repository-local hooks path so Quality checks commits even with a global `core.hooksPath`. Chain executable global pre-commit hooks, block commits when either hook fails, and report inactive Quality hooks with `quality hooks status`, without changing global or system Git configuration.
