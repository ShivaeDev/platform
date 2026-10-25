---
"@shivaedev/effect-contract": minor
"@shivaedev/effect-react": minor
---

### Added

- `bind` accepts an optional `resume: ResumeSource` to reopen and reconcile automatic live subscriptions from application lifecycle events alongside the browser defaults. Registry disposal unsubscribes the source.
- React automatic session subscriptions use the same source supplied to `bind` in `SessionBoundary.connect`, so native shells can reconcile live query screens from their own lifecycle events.
