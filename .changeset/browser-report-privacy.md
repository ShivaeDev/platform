---
"@shivaedev/errors": minor
"@shivaedev/server": minor
"@shivaedev/create-app": minor
---

### Added

- Add `redactBrowserText` to mask quoted browser literals, including escaped quotes and multiline content, while preserving diagnostic shape and the existing server text policy.
- Add opt-in `browserErrors` settings for an Error log per report, signed-in `user.id` attribution and session enforcement. The starter enables all three.

### Fixed

- Mask browser report messages and stacks before they reach diagnostic sinks and record reports at Error severity.
