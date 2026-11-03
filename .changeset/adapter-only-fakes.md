---
"@shivaedev/quality": minor
"@shivaedev/skills": patch
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/quality`: Reports module mocks and replacement spies of owned code outside `adapters/`, and resolvable Layer replacements of concrete owned services.

### Changed

- `@shivaedev/skills`: The story-testing skill permits repository fakes only at `adapters/` boundaries and requires deleting tests whose failures need internal fakes.

### Breaking

- `@shivaedev/quality`: Enables `tests/adapter-only-fakes` for every repository. Run owned modules and services for real, fake outside systems at `adapters/`, and delete tests that require internal replacements.

### Fixed

- `@shivaedev/create-app`: Generated apps receive the current story-testing guidance and exercise email delivery failures through the real mailer and a refusing Resend HTTP endpoint.
