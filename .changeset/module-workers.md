---
"@shivaedev/server": minor
"@shivaedev/jobs": minor
"@shivaedev/create-app": minor
---

### Added

- Server modules carry their queue declarations and worker Layers. `workerHost` runs workers with the same composed services and ports used by `appHost` after database preparation.
- Jobs exposes `jobModule` to derive a module's queue declarations and worker Layer from its registrations.

### Breaking

- Server modules now require a `name`, and `appModules` returns an Effect. Add a name to each module and use `yield* appModules(...)` inside an Effect before passing its result to either host. Duplicate queue names fail composition with `DuplicateModuleQueue`, identifying the queue and both owners.

### Fixed

- Generated minimal apps remove the notes module from the shared host and worker list without retaining a separate worker registry.
