---
"@shivaedev/form": minor
---

### Added

- Read whole-form Schema refinement messages with `errorAt([])` after submission and with `Invalid.formMessage` on invalid submissions.

### Fixed

- Hide previous asynchronous Schema messages on top-level fields while decoding changed input.

### Breaking

- `messageAtPath(issue, [])` now selects only whole-form issues. Pass a field path such as `["name"]` to select that field's first message.
