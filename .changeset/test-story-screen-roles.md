---
"@shivaedev/test-story": minor
---

### Added

- `screenDriver` actions and text/value readouts accept `ScreenTarget` selectors or `{ role, name }` targets, with exact string or regular-expression accessible names, hidden-element exclusion, candidate diagnostics and role/name narration.
- `screenDriver.accessible(element)` computes an existing element's accessible name and role without narration; `accessible(selector)` keeps its narrated readout.
