---
"@shivaedev/server": patch
---

### Fixed

- A host built with a deferred `application` Effect that builds its services itself with `Layer.build`, as the starter and every generated app do, now collects the models of those repositories: an operation it serves finds their owned models through `(yield* RepositoryModels).owned`, so identity's account export, erase and coverage check see them, and the fields those models mark sensitive or server-only are now masked in the host's logs, including logged defects, and its exported traces. Before, such a host collected nothing and left those fields unmasked.
