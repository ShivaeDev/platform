---
"@shivaedev/test-story": minor
---

### Added

- OTLP receiver errors include `service` from the export resource's `service.name`, or `undefined` when absent.

### Fixed

- `exportsSecret` also detects URL-encoded and form-encoded secrets in received exports.
