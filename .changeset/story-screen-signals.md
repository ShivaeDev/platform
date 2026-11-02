---
"@shivaedev/test-story": minor
---

### Breaking

- Remove `eventually` from `@shivaedev/test-story/client/react.ts`. Move story waits into kit verbs that await engine completion signals. For React results, supply the application's pending stream to `screenDriver`, await `settle()`, then assert on its readouts.
