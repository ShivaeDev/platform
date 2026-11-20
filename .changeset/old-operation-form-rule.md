---
"@shivaedev/quality": minor
---

### Added

- `operations/old-form` reports each module still written in the old operation form once, at its contract: a `contract` named by a string literal that lists queries or commands, whose operations are declared without `run`, served by a hand-written handler map and registered as `group` plus `handlers`. The finding names the module, so `quality baseline write` records how many modules an application has left to move to `defineModule`, and each move lowers the count. A contract that lists only streams, the host's own `platform.` protocol contracts and test code are accepted. The repair points to the framework guide's section on moving an existing module.
