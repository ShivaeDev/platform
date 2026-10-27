---
"@shivaedev/sql": minor
"@shivaedev/contract": minor
---

### Added

- SQL stories can declare domain read keys that cover written tables with `withChangeCoverage(body, { covers })` and assert committed change keys with `expectPublished(keys)`.
- Contract stories can observe a viewer's live stream with `watchHints` and use `heard(viewer, keys)` to await allowed hints or report denied keys as unheard on the story clock.
