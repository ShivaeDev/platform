---
"@shivaedev/work-fleet": minor
---

### Fixed

- Read all changed paths of large pull requests when GitHub's file listing and count disagree or the listing reaches its limit, using a local diff of the observed base and head commits. Failed reads still stop adoption.

### Breaking

- `compareChangedFiles` now takes `(host, pr, listed)` instead of `(read, repository, pr, listed)`. Callers must supply the Fleet host with its checkout directory and configured Git remote for the local comparison.
