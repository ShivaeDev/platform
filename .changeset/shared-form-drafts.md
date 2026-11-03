---
"@shivaedev/form": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/form`: Persist drafts through asynchronous native Effect storage operations, with optional observation across editors. Observed changes preserve local edits and adopt untouched fields.
- `@shivaedev/react`: Editors and create forms attach observed draft storage to the form atoms' lifetime.

### Fixed

- `@shivaedev/form`: Clear only the submitted draft revision after a successful save, keeping newer stored input from another editor. Serialize asynchronous writes and clears, and condition metadata writes on the owned revision.
- `@shivaedev/react`: Completing an older submission preserves newer shared draft input and local edits in progress.

### Breaking

- `@shivaedev/form`: Custom `DraftStorage.removeItem` implementations must accept `(key, expected)` and atomically remove only when the stored serialized value equals `expected`. Custom `setItem(key, value, expected?)` implementations must also compare atomically when `expected` is supplied, so rebasing accepted fields cannot overwrite newer stored input. Replace unconditional mutations with conditional mutations at the storage owner; writes without `expected` still store new local input. The browser adapter handles this contract; providers can keep synchronous reads and writes or return native Effects.
- `@shivaedev/form`: Lower-level `Persistence` integrations use `observe` and `revision` in place of `read`; mount the draft's atoms to own observation. Core form consumers mount `form.dirty` before reading restored input; asynchronous restoration arrives through the existing field refs. Form's React hooks attach this lifetime automatically.
