---
"@shivaedev/form": minor
---

### Added

- Forms without application service requirements can omit `runtime` and use an empty atom runtime. Handlers, advisory checks and schema decoding that require application services still need a matching runtime.

### Breaking

- `Config` is a conditional type so service requirements determine whether `runtime` is required. Extend generic configurations with an intersection type instead of an interface that extends `Config`.
