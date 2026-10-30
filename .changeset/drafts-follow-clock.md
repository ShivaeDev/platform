---
"@shivaedev/form": minor
"@shivaedev/react": minor
"@shivaedev/work-board": minor
---

### Breaking

- Persisted drafts require a `now: () => number` callback in core forms, `usePersistedDraft`, `useEditor` and `useCreate`. Capture `Clock.Clock` in the application’s Effect setup and pass `now: () => clock.currentTimeMillisUnsafe()` so timestamps and expiry follow that clock, including TestClock in stories.
- Form no longer exports the identity cast helpers `holder`, `fieldOf`, `choicesOf` or `checkOf` from `shape.ts`, or `keySelector` from `paths.ts`. Use declared reference, field, check and selector types directly; get field refs and choices through the form’s typed `field` and `choices` methods.

### Fixed

- Work Board reads draft timestamps and expiry through its form client’s runtime Clock.
