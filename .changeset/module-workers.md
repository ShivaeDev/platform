---
"@shivaedev/server": minor
"@shivaedev/jobs": minor
"@shivaedev/create-app": minor
---

### Added

- `@shivaedev/server`: Modules carry their queue declarations and worker Layers. `workerHost` runs workers with the same composed services and ports used by `appHost` after database preparation.
- `@shivaedev/jobs`: `jobModule` derives a module's queue declarations and worker Layer from its registrations.

### Breaking

- `@shivaedev/server`: Modules now require a `name`, and `appModules` returns an Effect. Add a name to each module and use `yield* appModules(...)` inside an Effect before passing its result to either host. Duplicate queue names fail composition with `DuplicateModuleQueue`, identifying the queue and both owners.

### Fixed

- `@shivaedev/create-app`: Generated minimal apps remove the notes module from the shared host and worker list without retaining a separate worker registry. Updating an older minimal app removes its unmodified worker registry when workers move into application modules.
