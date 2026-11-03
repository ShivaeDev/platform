---
"@shivaedev/work-board": minor
"@shivaedev/test-story": patch
---

### Added

- `@shivaedev/work-board`: Expose native contract client activity on the Board browser client for observing finite requests and live refresh completion.

### Changed

- `@shivaedev/work-board`: Run search debounce, navigation feedback and diagnostics polling on the Board's Effect Clock so application time can be controlled independently of browser timers.

### Fixed

- `@shivaedev/test-story`: Observe screen mutations through the mounted root's own window, including bundle pages in a separate window.
