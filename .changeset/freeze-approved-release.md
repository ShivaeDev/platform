---
"@shivaedev/releases": minor
---

### Fixed

- Accept pending changesets added later on main when a release records its base in `.changeset/release-base`, including after squash merging. Keep rejecting dropped or rewritten release inputs and notes. Pass the checked main revision as the optional fourth argument to `checkReleaseCoverage` when composing repository validation.

### Breaking

- `checkReleaseCoverage` now requires `FileSystem.FileSystem` to read the recorded release base. Provide `NodeServices.layer` from `@effect/platform-node`, or add a filesystem layer alongside the existing child-process spawner.
