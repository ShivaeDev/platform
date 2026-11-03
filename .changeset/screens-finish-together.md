---
"@shivaedev/test-story": minor
---

### Added

- Screen drivers accept a ScreenSignal projection of ClientActivity in `activity` and a completion signal in `transport`, waiting for these and application `pending` work to finish together.
- `mountApp({ create, render })` acquires each story's application, React root and atom registry in Scope without resetting modules.
