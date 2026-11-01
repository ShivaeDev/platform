---
"@shivaedev/releases": minor
---

### Fixed

- Reject planning, applying and checking releases with published dependencies on removed packages, including registry version ranges, and name the dependent and removed package. Snapshot plans also reject missing `workspace:` targets without base manifests. Development-only dependencies and private dependents do not block removal.

### Breaking

- `planRelease`, `applyRelease`, and the `plan` and `apply` CLI commands now read the Git base to reject removed dependencies even with registry version ranges. Run them in a Git repository with a resolvable `origin/main` or `main` and common history. Effect API callers must provide `ChildProcessSpawner.ChildProcessSpawner` alongside `FileSystem.FileSystem` (for example with `NodeServices.layer`) and handle `GitError` failures from history reads. For Git-free snapshot planning, call `computePlan(packages, sources, previousPackages)` with the base packages explicitly.
