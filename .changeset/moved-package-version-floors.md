---
"@shivaedev/releases": minor
---

### Added

- Configure per-package `versionFloors` to continue a moved package's published version line. Requested and dependent releases bump from the higher of the manifest version and its floor; applying and checking use the same plan without querying npm.
