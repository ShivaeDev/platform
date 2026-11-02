---
"@shivaedev/test-story": minor
---

### Added

- Read labelled element text with `labelledText(label)` and native table rows with `table(label)` in screen drivers.
- Scope a screen driver to a portal with `dialog(target)`. Member screens find body portals linked by their triggers' `aria-controls` while keeping other members' dialogs out of reach.
