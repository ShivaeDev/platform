---
"@shivaedev/test-story": minor
---

### Added

- Wait for visible text with `findText`, removal or hiding with `gone`, and a destination URL prefix with `navigatedAway`. Wait failures name their targets in the story report.
- Change native select controls with `select(target, value)` inside the renderer's `act` adapter.

### Fixed

- Reach portalled dialogs from the screen driver while keeping `within` scopes local, and find unnamed alerts by their visible text.
- Avoid holding `act` open between DOM mutations when no pending signal is supplied.
