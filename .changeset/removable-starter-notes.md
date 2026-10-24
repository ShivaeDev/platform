---
"@shivaedev/create-app": minor
"@shivaedev/quality": minor
---

### Changed

- New apps get the notes example as one removable module and fresh migrations. Apps already generated are unaffected.

### Added

- Quality recognizes client, server and numbered migration folders inside application modules, preserving their runtime boundaries.

### Fixed

- Generated apps install the queue schema before publishing application migrations, so workers started before deployment wait for all required schema work.
