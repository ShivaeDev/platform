---
"@shivaedev/create-app": minor
"@shivaedev/react": minor
"@shivaedev/test-story": minor
---

### Breaking

- Move the React test helpers to `@shivaedev/test-story/client/react.ts`. Replace imports from `@shivaedev/react/client/testing.ts` with this path for `render`, `eventually`, `captureReactWarnings`, `expectNoReactWarnings` and their types. Add `@shivaedev/test-story` as a development dependency and install its React helpers' optional peers `react`, `react-dom` and `@effect/atom-react` when using them. React no longer brings `@shivaedev/test` into applications as a runtime dependency.

### Changed

- Generated applications import React test helpers from their existing `@shivaedev/test-story` development dependency.
