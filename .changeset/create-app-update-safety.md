---
"@shivaedev/create-app": patch
---

### Fixed

- Record the applied starter version even when its merge leaves conflicts. List conflict-marker files and unresolved Git conflicts, run install and the app's typecheck, and exit nonzero with the remaining work instead of claiming success. Include dependency re-resolution guidance when pnpm rejects a trust downgrade.
